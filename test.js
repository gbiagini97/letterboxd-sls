const chance = require("chance").Chance();
var https = require("https");
const fs = require("fs");
const dataFile = fs.readFileSync("./loaded-data.json");
const loadedData = JSON.parse(dataFile);
const stateFile = fs.readFileSync(".serverless/state.dev.json");
const state = JSON.parse(stateFile);
const queries = {
  query1: `
  query MyQuery($userID: String!) {
    getUser(userID: $userID) {
      PK
      following {
        PK
        SK
      }
    }
  }`,

  query2: `
  query MyQuery($userID: String!) {
    getUser(userID: $userID) {
      PK
      following {
        PK
        SK
        reviews {
          PK
          SK
        }
      }
    }
  }`,

  query3: `
  query MyQuery($userID: String!) {
    getUser(userID: $userID) {
      PK
      following {
        PK
        SK
        reviews {
          PK
          SK
          movie {
            PK
            SK
          }
        }
      }
    }
  }`,
};
const choice = process.argv[2] || 'query1'

const throwOnErrors = ({ query, variables, errors }) => {
  if (errors) {
    const errorMessage = `
        query: ${query.substr(0, 100)}

        variables: ${JSON.stringify(variables, null, 4)}

        error: ${JSON.stringify(errors, null, 4)}
        `;
    throw new Error(errorMessage);
  }
};

async function gqlRequest(url, key, query, operationName, variables) {
  const data = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.split("://")[1].split("/")[0],
        port: 443,
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (data) => {
          chunks.push(data);
        });

        res.on("end", () => {
          resultdata = JSON.parse(Buffer.concat(chunks).toString());
          if (resultdata.errors != null) {
            throwOnErrors(query, variables, resultdata);
            reject(JSON.stringify(resultdata, null, 4));
          } else {
            resolve(resultdata);
          }
        });
      }
    );

    req.on("error", (error) => {
      console.error(error);
    });

    req.write(
      JSON.stringify({
        query: query,
        operationName: operationName,
        variables: variables,
      })
    );
    req.end();
  });

  return data.data;
}

async function loadTest(query, userID) {
  const appsync = {
    url: state.components.SingleTableAPI.outputs.AppsyncGraphQlApiUrl,
    key: state.components.SingleTableAPI.outputs.AppsyncGraphQlApiKeyDefault,
  };

  const appsync2 = {
    url: state.components.MultiTableAPI.outputs.Appsync2GraphQlApiUrl,
    key: state.components.MultiTableAPI.outputs.Appsync2GraphQlApiKeyDefault,
  };

  for (const appsyncConfig of [appsync, appsync2]) {
    const numberOfRequest = 5;
    for (let i = 0; i < numberOfRequest; i++) {
      const res = await gqlRequest(
        appsyncConfig.url,
        appsyncConfig.key,
        query,
        "MyQuery",
        { userID: userID }
      );
      //console.log(res);
    }
  }
}

async function main() {
  console.log('Executing ' + choice)

  const randomUser =
    loadedData.users[
      chance.integer({ min: 0, max: loadedData.users.length - 1 })
    ].PK;
  await loadTest(queries[choice], randomUser);
}

main();
