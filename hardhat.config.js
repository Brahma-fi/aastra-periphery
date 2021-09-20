require("@nomiclabs/hardhat-waffle");
require("hardhat-contract-sizer");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
const secrets = require("./secrets");

module.exports = {
  solidity: {
    version: "0.7.5",
    settings: {
      optimizer: {
        enabled: true,
        runs: 50
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-kovan.alchemyapi.io/v2/${secrets.alchemyAPIKey}`
      }
    },
    kovan: {
      url: `https://eth-kovan.alchemyapi.io/v2/${secrets.alchemyAPIKey}`,
      accounts: [`0x${secrets.privateKey}`]
    }
  },
  etherscan: { apiKey: secrets.etherscanKey }
};
