import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env["ALCHEMY_URL"] || "",
      accounts: process.env["PRIVATE_KEY"] ? [process.env["PRIVATE_KEY"]] : []
    }
  }
};

export default config;
