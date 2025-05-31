import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.23",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.8.28",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            }
        ]
    },
    networks: {
        hardhat: {
            // Local development network
        },
        // Only include sepolia if environment variables are properly set
        ...(process.env.SEPOLIA_RPC_URL && process.env.DEPLOYER_PRIVATE_KEY ? {
            sepolia: {
                url: process.env.SEPOLIA_RPC_URL,
                accounts: [
                    process.env.DEPLOYER_PRIVATE_KEY,
                    process.env.TAKER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
                    process.env.MAKER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
                ]
            }
        } : {})
    },

    etherscan: {
        apiKey: {
            sepolia: process.env.ETHERSCAN_API_KEY || ""
        }
    }
};

export default config;
