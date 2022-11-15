const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require("@aws-sdk/client-cloudformation");
const fs = require("fs");

async function main() {
  const stage = process.argv[2] || "dev";
  const service = process.argv[4] || "single-table-db";

  const client = new CloudFormationClient({
    region: process.argv[3] || "eu-central-1",
  });
  const command = new DescribeStacksCommand({
    StackName: `${service}-${stage}`,
  });
  const response = await client.send(command);

  const stackOutputs = response.Stacks[0].Outputs;

  let stringToWrite = "";
  for (const output of stackOutputs) {
    stringToWrite +=
      fromPascalCaseToUpperSnakeCase(output.OutputKey) +
      "=" +
      output.OutputValue +
      "\n";
  }

  fs.writeFileSync(".env", stringToWrite);
}

function fromPascalCaseToUpperSnakeCase(str) {
  return str
    .replace(/\.?([A-Z]+)/g, function (x, y) {
      return "_" + y;
    })
    .replace(/^_/, "")
    .toUpperCase();
}

main();