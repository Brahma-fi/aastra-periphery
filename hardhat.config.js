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
        url: `https://eth-mainnet.alchemyapi.io/v2/${secrets.alchemyAPIKey}`,
        blockNumber: 13360548
      }
    },

    mainnet: {
      url: "https://mainnet.infura.io/v3/d5ed64124bb0462a8675bdb92e707fd1",
      accounts: [`0x${secrets.privateKey}`],
      gasPrice: 64000000000
    },
    kovan: {
      url: `https://eth-kovan.alchemyapi.io/v2/${secrets.alchemyAPIKey}`,
      accounts: [`0x${secrets.privateKey}`]
    },
    customRPC: {
      url: "https://rpc.tenderly.co/fork/d6fc9a9c-85af-4ebc-972b-2e45be7ee721",
      accounts: [`0x${secrets.privateKey}`]
    }

  },
  etherscan: { apiKey: secrets.etherscanKey }
};
