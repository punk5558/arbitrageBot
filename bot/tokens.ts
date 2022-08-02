import fs from 'fs';
import path from 'path';
import 'lodash.combinations';
import lodash from 'lodash';
import { Contract } from '@ethersproject/contracts';
import { ethers } from 'hardhat';

import log from './log';

export enum Network {
  POLYGON = 'poly',
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const polyBaseTokens: Tokens = { // updated to polygon network addresses
  matic: { symbol: 'matic', address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270' },
  usdc: { symbol: 'usdc', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
  weth: { symbol: 'weth', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' },
};

const polyQuoteTokens: Tokens = { // updated to polygon network address
  //matic: { symbol: 'matic', address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270' },
  //usdc: { symbol: 'usdc', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
  usdt: { symbol: 'usdt', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
  //weth: { symbol: 'weth', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' },
  sand: { symbol: 'sand', address: '0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683' },
  quick: { symbol: 'quick', address: '0xB5C064F955D8e7F38fE0460C556a72987494eE17' },
  rvlt: { symbol: 'rvlt', address: '0xf0f9D895aCa5c8678f706FB8216fa22957685A13' },
  tel: { symbol: 'tel', address: '0xdF7837DE1F2Fa4631D716CF2502f8b230F1dcc32' },
  voxel: { symbol: 'voxel', address: '0xd0258a3fD00f38aa8090dfee343f10A9D4d30D3F' },
  ixt: { symbol: 'ixt', address: '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE' },
  gns: { symbol: 'gns', address: '0xE5417Af564e4bFDA1c483642db72007871397896' },
  qidao: { symbol: 'qi', address: '0x580A84C73811E1839F75d86d75d88cCa0c241fF4' },
  stmatic: { symbol: 'stmatic', address: '0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4' },
  mimatic: { symbol: 'mimatic', address: '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1' },
};

const polyDexes: AmmFactories = { // updated to polygon dex factories
  //uniswap: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
  sushiswap: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  quickswap: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
  dfyn: '0xE7Fb3e833eFE5F9c441105EB65Ef8b261266423B',
   //apeswap: '0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6',
  // value: '0x1B8E12F839BD4e73A47adDF76cF7F0097d74c14C',
};

function getFactories(network: Network): AmmFactories {
  switch (network) {
    case Network.POLYGON:
      return polyDexes;
    default:
      throw new Error(`Unsupported network:${network}`);
  }
}

export function getTokens(network: Network): [Tokens, Tokens] {
  switch (network) {
    case Network.POLYGON:
      return [polyBaseTokens, polyQuoteTokens];
    default:
      throw new Error(`Unsupported network:${network}`);
  }
}

async function updatePairs(network: Network): Promise<ArbitragePair[]> {
  log.info('Updating arbitrage token pairs');
  const [baseTokens, quoteTokens] = getTokens(network);
  const factoryAddrs = getFactories(network);

  const factoryAbi = ['function getPair(address, address) view returns (address pair)'];
  let factories: Contract[] = [];

  log.info(`Fetch from dexes: ${Object.keys(factoryAddrs)}`);
  for (const key in factoryAddrs) {
    const addr = factoryAddrs[key];
    const factory = new ethers.Contract(addr, factoryAbi, ethers.provider);
    factories.push(factory);
  }

  let tokenPairs: TokenPair[] = [];
  for (const key in baseTokens) {
    const baseToken = baseTokens[key];
    for (const quoteKey in quoteTokens) {
      const quoteToken = quoteTokens[quoteKey];
      let tokenPair: TokenPair = { symbols: `${quoteToken.symbol}-${baseToken.symbol}`, pairs: [] };
      for (const factory of factories) {
        const pair = await factory.getPair(baseToken.address, quoteToken.address);
        if (pair != ZERO_ADDRESS) {
          tokenPair.pairs.push(pair);
        }
      }
      if (tokenPair.pairs.length >= 2) {
        tokenPairs.push(tokenPair);
      }
    }
  }

  let allPairs: ArbitragePair[] = [];
  for (const tokenPair of tokenPairs) {
    if (tokenPair.pairs.length < 2) {
      continue;
    } else if (tokenPair.pairs.length == 2) {
      allPairs.push(tokenPair as ArbitragePair);
    } else {
      // @ts-ignore
      const combinations = lodash.combinations(tokenPair.pairs, 2);
      for (const pair of combinations) {
        const arbitragePair: ArbitragePair = {
          symbols: tokenPair.symbols,
          pairs: pair,
        };
        allPairs.push(arbitragePair);
      }
    }
  }
  return allPairs;
}

function getPairsFile(network: Network) {
  return path.join(__dirname, `../pairs-${network}.json`);
}

export async function tryLoadPairs(network: Network): Promise<ArbitragePair[]> {
  let pairs: ArbitragePair[] | null;
  const pairsFile = getPairsFile(network);
  try {
    pairs = JSON.parse(fs.readFileSync(pairsFile, 'utf-8'));
    log.info('Load pairs from json');
  } catch (err) {
    pairs = null;
  }

  if (pairs) {
    return pairs;
  }
  pairs = await updatePairs(network);

  fs.writeFileSync(pairsFile, JSON.stringify(pairs, null, 2));
  return pairs;
}
