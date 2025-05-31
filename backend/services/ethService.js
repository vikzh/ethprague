import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const USDT_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

export const getUSDTBalance = async (address) => {
  const [rawBalance, decimals] = await Promise.all([
    usdtContract.balanceOf(address),
    usdtContract.decimals()
  ]);
  return {
    address,
    balance: ethers.formatUnits(rawBalance, decimals),
    symbol: 'USDT'
  };
};
