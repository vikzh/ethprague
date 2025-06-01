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
    const toToken = stack.readBigNumber(); // cell containing a string
    const toAddress = stack.readBigNumber(); // cell containing a string
    const toAmount = stack.readBigNumber();         // uint64 / uint128
    const hashKey = stack.readBigNumber();         // uint64 / uint128

    let resolverAddr;
    try {
      resolverAddr = stack.readAddress();       // address
    }
    catch (error) {

    }


    // if no resolver_addr - status created
    // if resolver_addr and from_amount not 0 - pending
    // if resolver_addr && from_amount == 0  - completed

    let status;
    if (!resolverAddr) {
      status = 'created';
    } else {
      if (fromAmount.toString() !== '0') {
        status = 'pending';
      } else {
        status = 'completed';
      }
    }

    const order = {
      order_id: orderIdd.toString(),
      from_address: fromAddress.toString(),
      from_amount: fromAmount.toString(),
      to_network: toNetwork,
      to_address: toAddress.toString(),
      to_token: toToken.toString(),
      to_amount: toAmount.toString(),
      hash_key: hashKey.toString(),
      status: status,
      escrow_contract_address: contractAddress.toString(),
      // resolver_addr: resolverAddr.toString()
    };

    if (resolverAddr) {
      order.resolver_addr = resolverAddr.toString();
    }

    return order
  } catch (err) {
    console.error("Error reading contract:", err);
    res.status(500).json({ error: err.message });
  }
}


export const calculateAddress = async (userAddress, orderId) => {
  console.log(`Calculate order address for User: ${userAddress}, orderId: ${orderId}`);
  const contractAddress = "EQAwfeIet0E_vW9_DDRED_nlqsJ0rgVdniGIdcHzARQWJnxh";

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