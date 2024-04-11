import express from "express";
import cors from "cors";
import { secp256k1 } from "ethereum-cryptography/secp256k1";
import { keccak256 } from "ethereum-cryptography/keccak";
import { toHex } from "ethereum-cryptography/utils";

const app = express();
const port = 3042;

app.use(cors());
app.use(express.json());

// Just to keep in memory some private key to not regenerate everytime. 
// Never do that on real project
const privateKeys = [
  "01b991084df8980dfc36a8ce2cc906d73ae3bfbb4851ad6dd659a67c5f564c12",
  "cd87d4315e7bb477dc76474d489114ece9312555f406e6f3a67c140403ed97c5",
]

let balances = {};

balances[getWalletAddress(privateKeys[0])] = 100;
balances[getWalletAddress(privateKeys[1])] = 75;

app.get("/balance/:address", (req, res) => {
  const { address } = req.params;
  const balance = balances[address] || 0;
  res.send({ balance });
});

app.post("/send", (req, res) => {
  const { recipient, amount, signature, msgHash, recoveryBit } = req.body;

  let sig = secp256k1.Signature.fromCompact(signature);
  sig = sig.addRecoveryBit(recoveryBit)
  const publicKey = sig.recoverPublicKey(msgHash).toRawBytes();
  const sender = toHex((keccak256(publicKey.slice(1))).slice(-20));

  setInitialBalance(sender);
  setInitialBalance(recipient);

  if (!secp256k1.verify(signature, msgHash, publicKey)) {
    res.status(403).send({ message: "Forbidden, signature is false!"});
  }

  if (balances[sender] < amount) {
    res.status(400).send({ message: `Not enough funds! You only have ${balances[sender]}` });
  } else {
    balances[sender] -= amount;
    balances[recipient] += amount;
    res.send({ balance: balances[sender] });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}!`);
});

function setInitialBalance(address) {
  if (!balances[address]) {
    balances[address] = 0;
  }
}

function getWalletAddress(privateKey) {
  const publicKey = secp256k1.getPublicKey(privateKey);
  const address = (keccak256(publicKey.slice(1))).slice(-20);
  return toHex(address);
}
