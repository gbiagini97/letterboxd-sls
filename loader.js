"use strict";
const fs = require("fs");
const chance = require("chance").Chance();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const file = fs.readFileSync(".serverless/state.dev.json");
const state = JSON.parse(file);

const client = new DynamoDBClient();
const doc = DynamoDBDocumentClient.from(client);
const promises = [];

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function load(tableName, entries) {
  const chunks = chunkArray(entries, 25);

  for (const c of chunks) {
    let command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: [],
      },
    });

    for (const e of c) {
      command.input.RequestItems[tableName].push({
        PutRequest: {
          Item: e,
        },
      });
    }
    promises.push(doc.send(command));
  }
}

function generateMovies(moviesCount, listsCount, reviewsCount) {
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
      listsCount: chance.integer({ min: 0, max: listsCount - 1 }),
      reviewsCount: chance.integer({ min: 0, max: reviewsCount - 1 }),
    });
  }

  return movies;
}

function generateUsers(
  usersCount,
  relationshipsCount,
  moviesCount,
  listsCount,
  reviewsCount
) {
  const users = [];
  for (let i = 0; i < usersCount; i++) {
    let email = chance.integer({ min: 0, max: 10000 }) + chance.email();
    users.push({
      PK: "USER#" + email,
      SK: "USER#" + email,
      __typename: "USER",
      email: email,
      name: chance.name(),
      bio: chance.sentence(),
      followersCount: chance.integer({ min: 0, max: relationshipsCount }),
      followingCount: chance.integer({ min: 0, max: relationshipsCount }),
      reviewsCount: chance.integer({ min: 0, max: moviesCount - 1 }),
      listsCount: chance.integer({ min: 0, max: listsCount }),
      likesCount: chance.integer({ min: 0, max: reviewsCount - 1 }),
      updatedAt: new Date().toISOString(),
    });
  }

  return users;
}

function generateReviews(reviewsCount, usersCount, moviesCount, users, movies) {
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

  return reviews;
}

function generateLists(listsCount, usersCount, users) {
  const lists = [];
  for (let i = 0; i < listsCount; i++) {
    let name =
      chance.sentence({ punctuation: false, words: 10 }) +
      " " +
      chance.integer({ min: 0, max: 10000 });
    lists.push({
      PK: users[chance.integer({ min: 0, max: usersCount - 1 })].PK,
      SK: "LIST#" + name.replace(/\W/g, "-"),
      __typename: "LIST",
      name: name,
      updatedAt: new Date().toISOString(),
    });
  }

  return lists;
}

function generateAssociations(lists, movies) {
  const associations = [];
  for (const list of lists) {
    for (const movie of movies) {
      if (chance.bool({ likelihood: 30 })) {
        associations.push({
          PK: list.SK,
          SK: movie.PK,
          __typename: "ASSOCIATION",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return associations;
}

function generateRelationships(users) {
  const relationships = [];
  for (const user1 of users) {
    for (const user2 of users) {
      if (user1 != user2 && chance.bool({ likelihood: 50 })) {
        relationships.push({
          PK: user1.PK,
          SK: user2.PK,
          __typename: "FOLLOW",
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
  return relationships;
}

function prepInput(moviesCount = 60, usersCount = 100, listsCount = 50) {
  const reviewsCount = chance.integer({
    min: Math.floor((moviesCount * usersCount) / 10),
    max: moviesCount * usersCount,
  });
  const relationshipsCount = chance.integer({
    min: Math.floor((usersCount * usersCount) / 10),
    max: usersCount * usersCount - usersCount,
  });

  // generate movies
  const movies = generateMovies(moviesCount, listsCount, reviewsCount);
  load(state.components.MultiTableDB.outputs.MoviesTableID, movies);

  // generate users
  const users = generateUsers(
    usersCount,
    relationshipsCount,
    moviesCount,
    listsCount,
    reviewsCount
  );
  load(state.components.MultiTableDB.outputs.UsersTableID, users);

  // generate reviews
  const reviews = generateReviews(
    reviewsCount,
    usersCount,
    moviesCount,
    users,
    movies
  );
  load(state.components.MultiTableDB.outputs.ReviewsTableID, reviews);

  // generate lists
  const lists = generateLists(listsCount, usersCount, users);
  load(state.components.MultiTableDB.outputs.ListsTableID, lists);

  // assign movies to lists
  const associations = generateAssociations(lists, movies);
  load(state.components.MultiTableDB.outputs.AssociationsTableID, associations);

  // create followings between users
  const relationships = generateRelationships(users);
  load(
    state.components.MultiTableDB.outputs.RelationshipsTableID,
    relationships
  );

  load(state.components.SingleTableDB.outputs.SingleTableID, [
    ...movies,
    ...users,
    ...reviews,
    ...lists,
    ...associations,
    ...relationships,
  ]);

  fs.writeFileSync(
    "./loaded-data2.json",
    JSON.stringify({
      movies: movies,
      users: users,
      reviews: reviews,
      lists: lists,
      associations: associations,
      relationships: relationships,
    })
  );
}

async function main() {
  prepInput(30, 20, 10);

  const status = await Promise.allSettled(promises);

  for (const s of status) {
    console.log(s);
  }
}

main();
