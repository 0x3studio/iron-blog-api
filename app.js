const express = require("express");
const createError = require("http-errors");
const cors = require("cors");

const { Wallet } = require("ethers");
const { WarpFactory } = require("warp-contracts");
const { buildEvmSignature } = require("warp-contracts-plugin-signature/server");

require("dotenv").config();

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send({ status: "ok" });
});

app.get("/:contractTxId", async (req, res, next) => {
  const contractTxId = req.params.contractTxId;

  const warp = WarpFactory.forMainnet({ inMemory: true, dbLocation: "2" });
  const wallet = Wallet.createRandom();

  const contract = warp
    .contract(contractTxId)
    .connect({ type: "ethereum", signer: buildEvmSignature(wallet) });

  try {
    const { cachedValue } = await contract.readState();
    res.send(
      Object.values(cachedValue.state.articles)
        .map((item) => {
          return {
            id: item.id,
            visible: item.visible,
            featured: item.featured,
            publishDate: item.publishDate,
            ...item.current,
          };
        })
        .sort((a, b) => {
          return b.publishDate - a.publishDate;
        })
    );
  } catch (err) {
    next(createError(404));
  }
});

app.get("/:contractTxId/:articleId", async (req, res, next) => {
  const contractTxId = req.params.contractTxId;
  const articleId = req.params.articleId;

  const warp = WarpFactory.forMainnet({ inMemory: true, dbLocation: "2" });
  const wallet = Wallet.createRandom();

  const contract = warp
    .contract(contractTxId)
    .connect({ type: "ethereum", signer: buildEvmSignature(wallet) });

  try {
    const { cachedValue } = await contract.readState();
    const item = cachedValue.state.articles[articleId];

    const response = await fetch(
      `${process.env.ARWEAVE_GATEWAY_URL}/${item.current.txId}`
    );
    const text = await response.text();

    const index = text.split("---\n", 2).join("---\n").length + 4;
    const content = text.substring(index);

    res.send({
      id: item.id,
      visible: item.visible,
      featured: item.featured,
      publishDate: item.publishDate,
      ...item.current,
      content,
    });
  } catch (err) {
    next(createError(404));
  }
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send({ status: "error" });
});

module.exports = app;
