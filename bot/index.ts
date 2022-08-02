import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import pool from '@ricokahler/pool';
import AsyncLock from 'async-lock';

import { FlashBot } from '../typechain/FlashBot';
import { Network, tryLoadPairs, getTokens } from './tokens';
import { getMaticPrice } from './basetoken-price';
import log from './log';
import config from './config';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function calcNetProfit(profitWei: BigNumber, address: string, baseTokens: Tokens): Promise<number> {
  let price = 1;
  //console.log("testing6");
  //console.log(baseTokens.matic.address);
  if (baseTokens.matic.address == address) {
    //console.log("testing7");
    price = await getMaticPrice();
  }
  let profit = parseFloat(ethers.utils.formatEther(profitWei));
  profit = profit * price;

  const gasCost = price * parseFloat(ethers.utils.formatEther(config.gasPrice)) * (config.gasLimit as number);
  return profit - gasCost;
}

function arbitrageFunc(flashBot: FlashBot, baseTokens: Tokens) {
  const lock = new AsyncLock({ timeout: 2000, maxPending: 20 });
  return async function arbitrage(pair: ArbitragePair) {
    const [pair0, pair1] = pair.pairs;
    //console.log("testing1");
    let res: [BigNumber, string] & {
      profit: BigNumber;
      baseToken: string;
    };
    try {
      //console.log("testing2");
      res = await flashBot.getProfit(pair0, pair1);
      log.debug(`Profit on ${pair.symbols}: ${ethers.utils.formatEther(res.profit)}`);
    } catch (err) {
      log.debug(err);
      return;
    }

    if (res.profit.gt(BigNumber.from('0'))) {
      //console.log("testing3");
      const netProfit = await calcNetProfit(res.profit, res.baseToken, baseTokens);
      //console.log("testing4");
      if (netProfit < config.minimumProfit) {
        //console.log("testing5");
        return;
      }

      log.info(`Calling flash arbitrage, net profit: ${netProfit}`);
      try {
        // lock to prevent tx nonce overlap
        await lock.acquire('flash-bot', async () => {
          const response = await flashBot.flashArbitrage(pair0, pair1, {
            gasPrice: config.gasPrice,
            gasLimit: config.gasLimit,
          });
          const receipt = await response.wait(1);
          log.info(`Tx: ${receipt.transactionHash}`);
        });
      } catch (err) {
        if (err.message === 'Too much pending tasks' || err.message === 'async-lock timed out') {
          return;
        }
        log.error(err);
      }
    }
  };
}

async function main() {
  const pairs = await tryLoadPairs(Network.POLYGON);
  const flashBot = (await ethers.getContractAt('FlashBot', config.contractAddr)) as FlashBot;
  const [baseTokens] = getTokens(Network.POLYGON);

  log.info('Start arbitraging');
  while (true) {
    await pool({
      collection: pairs,
      task: arbitrageFunc(flashBot, baseTokens),
      // maxConcurrency: config.concurrency,
    });
    await sleep(1000);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error(err);
    process.exit(1);
  });
