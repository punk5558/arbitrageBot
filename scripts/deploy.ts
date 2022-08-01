import { ethers, run } from 'hardhat';

import deployer from '../.secret';

// MATIC ADDRESS ON POLYGON
const WethAddr = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';

async function main() {
  await run('compile');
  const FlashBot = await ethers.getContractFactory('FlashBot');
  const flashBot = await FlashBot.deploy(WethAddr);

  console.log(`FlashBot deployed to ${flashBot.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
