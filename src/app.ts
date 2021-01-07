import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { deterministicProjection, cleanRequest } from "./calculations";

const app = express();
const port = 4000;

app.use(bodyParser.json());

app.listen(port, () => {
  return console.log(`server is listening on ${port}`);
});

app.options("*", cors());
app.get("/heartbeat", cors(), (req, res) => {
  res.json(`401k simulator is running (${new Date()})`);
});

app.post("/balances", cors(), (req, res) => {
  console.log(req.body);
  res.json(deterministicProjection(req.body));
});
