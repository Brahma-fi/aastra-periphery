const hre = require("hardhat");

const etherscan_verify = true;

const FACTORY_ADDRESS = "0x5fE99C34146C8edE7BCEB7bd6a15E0aAA81a591e";

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const Periphery = await hre.ethers.getContractFactory("Periphery");
  const periphery = await Periphery.deploy(FACTORY_ADDRESS);

  await periphery.deployed();

  console.log("Periphery deployed to:", periphery.address);

  await timeout(15000);
  if (etherscan_verify) {
    await hre.run("verify:verify", {
      address: periphery.address,
      constructorArguments: [FACTORY_ADDRESS]
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
