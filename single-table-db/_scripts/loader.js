"use strict";
require("dotenv").config();
const chance = require("chance").Chance();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const { SINGLE_TABLE_ID } = process.env;

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function prepInput(moviesCount = 60, usersCount = 100, listsCount = 50) {
  const reviewsCount = chance.integer({
    min: Math.floor((moviesCount * usersCount) / 10),
    max: moviesCount * usersCount,
  });
  const relatioshipsCount = chance.integer({
    min: Math.floor((usersCount * usersCount) / 10),
    max: usersCount * usersCount - usersCount,
  });

  // generate movies
  const movies = [];
  for (let i = 0; i < moviesCount; i++) {
    let title =
      "The " +
      chance.animal() +
      " in " +
      chance.city() +
      " " +
      chance.integer({ min: 1, max: 100 });
    movies.push({
      PK: "MOVIE#" + title.replace(/\W/g, "-"),
      SK: "MOVIE#" + title.replace(/\W/g, "-"),
      __typename: "MOVIE",
      title: title,
      releaseDate: chance.date({ max: new Date() }).toISOString(),
      updatedAt: new Date().toISOString(),
      director: chance.name(),
      listsCount: chance.integer({ min: 0, max: listsCount }),
      reviewsCount: chance.integer({ min: 0, max: reviewsCount - 1 }),
    });
  }

  //console.log(movies);

  // generate users
  const users = [];
  for (let i = 0; i < usersCount; i++) {
    let email = chance.integer({min: 0, max: 10000}) + chance.email();
    users.push({
      PK: "USER#" + email,
      SK: "USER#" + email,
      __typename: "USER",
      email: email,
      name: chance.name(),
      bio: chance.sentence(),
      followersCount: chance.integer({ min: 0, max: relatioshipsCount }),
      followingCount: chance.integer({ min: 0, max: relatioshipsCount }),
      reviewsCount: chance.integer({ min: 0, max: moviesCount - 1 }),
      listsCount: chance.integer({ min: 0, max: listsCount }),
      likesCount: chance.integer({ min: 0, max: reviewsCount - 1 }),
      updatedAt: new Date().toISOString(),
    });
  }

  //console.log(users);

  // generate reviews
  const reviews = [];
  for (let i = 0; i < reviewsCount; i++) {
    reviews.push({
      PK: users[chance.integer({ min: 0, max: usersCount - 1 })].PK,
      SK: movies[chance.integer({ min: 0, max: moviesCount - 1 })].PK,
      __typename: "REVIEW",
      rating: chance.integer({ min: 1, max: 10 }),
      description: chance.sentence(),
      likesCount: chance.integer({ min: 0, max: usersCount - 1 }),
      updatedAt: new Date().toISOString(),
    });
  }

  //console.log(reviews);

  // generate lists
  const lists = [];
  for (let i = 0; i < listsCount; i++) {
    let name = chance.sentence({ punctuation: false, words: 10 })+ " " + chance.integer({min: 0, max: 10000});
    lists.push({
      PK: users[chance.integer({ min: 0, max: usersCount - 1 })].PK,
      SK: "LIST#" + name.replace(/\W/g, "-"),
      __typename: "LIST",
      name: name,
      updatedAt: new Date().toISOString(),
    });
  }

  // assign movies to lists
  const listEntries = [];
  for (const list of lists) {
    for (const movie of movies) {
      if (chance.bool({likelihood: 30})) {
        listEntries.push({
          PK: movie.PK,
          SK: list.SK,
          __typename: "LIST_ENTRY",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // create followings between users
  const relationships = [];
  for (const user1 of users) {
    for (const user2 of users) {
      if (user1 != user2 && chance.bool({likelihood: 50})) {
        relationships.push({
          PK: user1.PK,
          SK: user2.PK,
          __typename: "FOLLOW",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  //return [
  //  ...movies,
  //  ...users,
  //  ...reviews,
  //  ...lists,
  //  ...listEntries,
  //  ...relationships,
  //];

  console.log(JSON.stringify([
    ...movies,
    ...users,
    ...reviews,
    ...lists,
    ...listEntries,
    ...relationships,
  ]));
}

async function main() {
  const client = new DynamoDBClient();
  const doc = DynamoDBDocumentClient.from(client);

  const entries = prepInput();
  const chunks = chunkArray(entries, 25);

  const promises = [];

  for (const c of chunks) {
    let command = new BatchWriteCommand({
      RequestItems: {
        [SINGLE_TABLE_ID]: [],
      },
    });

    for (const e of c) {
      command.input.RequestItems[SINGLE_TABLE_ID].push({
        PutRequest: {
          Item: e,
        },
      });
    }

    //console.log(command)

    promises.push(doc.send(command));
  }

  const status = await Promise.allSettled(promises)

  for (const s of status) {
    console.log(s)
  }

  //const res = await doc.send(
  //  new BatchWriteCommand({
  //    RequestItems: {
  //      [SINGLE_TABLE_ID]: [
  //        {
  //          PutRequest: {
  //            Item: {
  //              PK: "ao",
  //              SK: "ae"
  //            },
  //          },
  //        },
  //      ],
  //    },
  //  })
  //);


  // chunk entries

  // batch write
}

//main();

prepInput(2, 5, 3)
