import {TonClient} from "@ton/ton";
import {Address, beginCell} from "@ton/core";


export const getExtraDataAboutOrder = async (address, orderId) => {
  try {
    const contractAddress = await calculateAddress(address, orderId);
    console.log('calculated address to get info about order: ',contractAddress);

    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    });

    // Call get method
    const result = await client.runMethod(
      contractAddress,
      "get_escrow_data"
    );

    const stack = result.stack;

    const orderIdd = stack.readBigNumber();          // uint64 / uint128
    const fromAddress = stack.readAddress();        // address
    const fromAmount = stack.readBigNumber();       // uint64 / uint128
    const toNetwork = stack.readNumber();           // int or enum
    const toAddress = stack.readBigNumber(); // cell containing a string
    const toAmount = stack.readBigNumber();         // uint64 / uint128
    const hashKey = stack.readBigNumber();         // uint64 / uint128
    // const resolverAddr = stack.readAddress();       // address

    return {
      order_id: orderIdd.toString(),
      from_address: fromAddress.toString(),
      from_amount: fromAmount.toString(),
      to_network: toNetwork,
      to_address: toAddress.toString(),
      to_amount: toAmount.toString(),
      hash_key: hashKey.toString(),
      // resolver_addr: resolverAddr.toString()
    };
  } catch (err) {
    console.error("Error reading contract:", err);
    res.status(500).json({ error: err.message });
  }
}


export const calculateAddress = async (userAddress, orderId) => {
  console.log(`Calculate order address for User: ${userAddress}, orderId: ${orderId}`);
  const contractAddress = "kQCrB1b7x5xWsm4AqbWbRZyfEuutYnOfunbGUdiogILGOX3s";

  const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
  });

  // Call get method
  const result = await client.runMethod(
    Address.parseFriendly(contractAddress).address,
    "get_order_address",
    [
      {
        type: 'slice',
        cell: beginCell().storeAddress(Address.parse(userAddress)).endCell(),
      },
      {
        type: 'int',
        value: orderId,
      }
    ]
  );

  const stack = result.stack;
  const fromAddress = stack.readAddress();
  return fromAddress;
}