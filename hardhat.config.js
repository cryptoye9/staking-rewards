require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-contract-sizer");
require("hardhat-abi-exporter");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-web3");

// See `README.md` for details

/*
 * Private keys for the network configuration.
 *
 * Setting in `.env` file.
 */
//const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(",") : [];
const BSC_PRIVATE_KEY = process.env.BSC_PRIVATE_KEY || ''
const BSCSCANAPIKEY_API_KEY = process.env.BSCSCANAPIKEY_API_KEY || ''
const BSC_TESTNET_PRIVATE_KEY = process.env.BSC_TESTNET_PRIVATE_KEY || ''
const BSC_TESTNET = process.env.BSC_TESTNET || ''
const BSC_MAINNET = process.env.BSC_MAINNET || ''

/*
 * The solc compiler optimizer configuration. (The optimizer is disabled by default).
 *
 * Set `ENABLED_OPTIMIZER` in `.env` file to true for enabling.
 */
// `!!` to convert to boolean
const ENABLED_OPTIMIZER = !!process.env.ENABLED_OPTIMIZER || !!process.env.REPORT_GAS || false;
const OPTIMIZER_RUNS = process.env.OPTIMIZER_RUNS ? +process.env.OPTIMIZER_RUNS : 200; // `+` to convert to number

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.13",
                settings: {
                    optimizer: {
                        enabled: ENABLED_OPTIMIZER,
                        runs: OPTIMIZER_RUNS
                    }
                }
            },
            {
                version: "0.8.7",
                settings: {
                    optimizer: {
                        enabled: ENABLED_OPTIMIZER,
                        runs: OPTIMIZER_RUNS
                    }
                }
            }//,
            // { // Example of adding multiple compiler versions within the same project
            //     version: "0.7.6",
            //     settings: {
            //         optimizer: {
            //             enabled: ENABLED_OPTIMIZER,
            //             runs: OPTIMIZER_RUNS
            //         }
            //     }
            // }
        ]//,
        // overrides: { // Example of specifying a compiler for a specified contract
        //     "contracts/Foo.sol": {
        //         version: "0.5.5",
        //         settings: { }
        //     }
        // }
    },
    // defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            allowUnlimitedContractSize: !ENABLED_OPTIMIZER,
            forking: {
                url: process.env.FORKING_URL || "",
                enabled: process.env.FORKING !== undefined
            }
        },
        testnet: {
            url: BSC_TESTNET,
            chainId: 97,
            gasPrice: 16000000000,
            gas: 21000000,
            gasLimit: 21000000,
            accounts: [BSC_TESTNET_PRIVATE_KEY],
        },
        mainnet: {
            url: BSC_MAINNET,
            chainId: 56,
            gasPrice: 10000000000,
            accounts: [BSC_PRIVATE_KEY],
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        // excludeContracts: ["mocks/"],
        currency: "USD",
        outputFile: process.env.GAS_REPORT_TO_FILE ? "gas-report.txt" : undefined
    },
    etherscan: {
        apiKey: process.env.BSCSCANAPIKEY_API_KEY,
        url: process.env.ETHERSCAN_URL || ""
        // Can be done this way for using of multiple API keys
        // This is not necessarily the same name that is used to define the network. See the link for details:
        // https://hardhat.org/plugins/nomiclabs-hardhat-etherscan.html#multiple-api-keys-and-alternative-block-explorers
        //
        // apiKey: {
        //     mainnet: "YOUR_ETHERSCAN_API_KEY",
        //     rinkeby: "YOUR_ETHERSCAN_API_KEY",
        //     ropsten: "YOUR_ETHERSCAN_API_KEY",
        //     kovan: "YOUR_ETHERSCAN_API_KEY"
        // }//,
        // url: {
        //     mainnet: "ETHERSCAN_URL",
        //     rinkeby: "ETHERSCAN_URL",
        //     ropsten: "ETHERSCAN_URL",
        //     kovan: "ETHERSCAN_URL"
        // }
    },
    contractSizer: {
        except: ["mocks/"]
    },
    abiExporter: {
        pretty: true,
        except: ["interfaces/", "mocks/"]
    }
};

// By default fork from the latest block
if (process.env.FORKING_BLOCK_NUMBER)
    module.exports.networks.hardhat.forking.blockNumber = +process.env.FORKING_BLOCK_NUMBER;

/*
 * This setting changes how Hardhat Network works, to mimic Ethereum's mainnet at a given hardfork. It must be one of
 * "byzantium", "constantinople", "petersburg", "istanbul", "muirGlacier", "berlin", "london" and "arrowGlacier".
 * Default value: "arrowGlacier".
 */
if (process.env.HARDFORK)
    module.exports.networks.hardhat.hardfork = process.env.HARDFORK;
