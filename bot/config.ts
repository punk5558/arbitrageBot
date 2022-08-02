import { BigNumber, BigNumberish, utils } from 'ethers';

interface Config {
  contractAddr: string;
  logLevel: string;
  minimumProfit: number;
  gasPrice: BigNumber;
  gasLimit: BigNumberish;
  polyScanUrl: string;
  concurrency: number;
}

const contractAddr = '0x1530dCD2677469ed3F7B7DdE65cA10A8a65051e0'; // flash bot contract address
const gasPrice = utils.parseUnits('10', 'gwei');
const gasLimit = 300000;

const polyScanApiKey = 'QQH58JJ44PQMK7XW3TYBXB2H5PKH44479P'; // bscscan API key
const polyScanUrl = `https://api.polygonscan.com/api?module=stats&action=maticprice&apikey=${polyScanApiKey}`;

const config: Config = {
  contractAddr: contractAddr,
  logLevel: 'info',
  concurrency: 50,
  minimumProfit: 1, // in USD
  gasPrice: gasPrice,
  gasLimit: gasLimit,
  polyScanUrl: polyScanUrl,
};

export default config;
