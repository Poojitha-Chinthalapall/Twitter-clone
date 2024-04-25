const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

let db
const dbpath = path.join(__dirname, 'twitterClone.db')
const app = express()
app.use(express.json())

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running on http://localhost:3000/')
    })
  } catch (error) {
    console.log(`DB Error is ${error.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const checkUser = `SELECT username FROM user WHERE username = "${username}";`
  const dbUser = await db.get(checkUser)
  console.log(dbUser)
  if (dbUser !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const requestQuery = `INSERT INTO user(name, username, password, gender) VALUES (
                "${name}", "${username}", "${hashedPassword}", "${gender}"
            );`
      await db.run(requestQuery)
      response.status(200)
      response.send('User created successfully')
    }
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const checkUser = `
    SELECT * FROM user WHERE username = "${username}";`
  const dbUserExist = await db.get(checkUser)
  if (dbUserExist !== undefined) {
    const checkPassword = await bcrypt.compare(password, dbUserExist.password)
    if (checkPassword === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'secret_key')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, 'secret_key', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  let {username} = request
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = "${username}";`
  const getUserId = await db.get(getUserIdQuery)

  const getFollowerIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`
  const getFollowerIds = await db.all(getFollowerIdsQuery)

  const getFollowerIdsSimple = getFollowerIds.map(eachUser => {
    return eachUser.following_user_id
  })

  const getTweetQuery = `SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
    FROM user INNER JOIN tweet
    ON user.user_id = tweet.user_id WHERE user.user_id IN (${getFollowerIdsSimple})
    ORDER BY tweet.date_time DESC LIMIT 4;`
  const responseResult = await db.all(getTweetQuery)
  response.send(responseResult)
})

app.get('/user/following/', authenticateToken, async (request, response) => {
  let {username} = request
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = "${username}";`
  const getUserId = await db.get(getUserIdQuery)

  const getFollowerIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery)

  const getFollowerIds = getFollowerIdsArray.map(eachUser => {
    return eachUser.following_user_id
  })

  const getFollowersResultQuery = `SELECT name FROM user WHERE user_id IN (${getFollowerIds});`
  const responseResult = await db.all(getFollowersResultQuery)
  response.send(responseResult)
})

app.get("/user/followers/", authenticateToken, async(request, response) => {
    let {username} = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowerIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`
    const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
    console.log(getFollowerIdsArray);

    const getFollowerIds = getFollowerIdsArray.map(eachUser => {
    return eachUser.following_user_id

});
console.log(`${getFollowerIds}`);

const getFollowersNameQuery = `SELECT name FROM user WHERE user_id IN (${getFollowerIds});`;
const getFollowersName = await db.all(getFollowersNameQuery);
response.send(getFollowersName);
});

const api6Output = (tweetData, likesCount, replyCount) => {
    return {
        tweet : tweetData.tweet,
        likes : likesCount.likes,
        replies : replyCount.replies,
        dataTime : tweetData.data_time,
    };
};

app.get("/tweets/:tweetId/", authenticateToken, async(request, response) => {
    const {tweetId} = request.params;
    let {username} = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
   // console.log(getFollowingIdsArray);

    const getFollowingIds = getFollowingIdsArray.map(eachFollower => {
    return eachFollower.following_user_id

});
   const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
   const getTweetIdsArray = await db.all(getTweetIdsQuery);
   const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.twet_id;
   });
   if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `SELECT COUNT(user_id) AS likes FROM like WHERE tweet_id=${tweetId};`;
    const likes_count = await db.get(likes_count_query);

    const reply_count_query = `SELECT COUNT(user_id) AS replies FROM reply WHERE tweet_id=${tweetId};`;
    const reply_count = await db.get(reply_count_query);

    const tweet_tweetDateQuery = `SELECT tweet, date_time FROM tweet WHERE tweet_id=${tweetId};`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);

    response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
   } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
   }
    
});

const convertLikedUserNameDBObjectToResponseObject = (dbObject) => {
    return {
        likes : dbObject,
    };
};

app.get("/tweets/:tweetId/likes/", authenticateToken, async(request, response) => {
    const {tweetId} = request.params;
    let {username} = request;

    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
   // console.log(getFollowingIdsArray);

    const getFollowingIds = getFollowingIdsArray.map(eachFollower => {
    return eachFollower.following_user_id

});
    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
   const getTweetIdsArray = await db.all(getTweetIdsQuery);
   const followingTweetIds = getTweetIdsArray.map((eachTweet) => {
    return eachTweet.twet_id;
});

   if (getTweetIds.includes(parseInt(tweetId))) {
    const getLikedUsersNameQuery = `SELECT user.username AS likes FROM user INNER JOIN like
    ON user.user_id = like.user_id WHERE like.tweet_id = ${tweetId};`;

    const getLikedUsersNameArray = await db.all(getLikedUsersNameQuery);

    const getLikedUserNames = getLikedUsersNameArray.map((eachUser) => {
        return eachUser.likes;
    });
    response.send(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
    );
   } else {
    response.status(401);
    response.send("Invalid Request");
   }
}
);

const convertUserNameReplyedDBObjectToResponseObject = (dbObject) => {
    return {
        replies : dbObject,
    };
};

app.get("/tweets/:tweetId/replies/", authenticateToken, async(request, response) => {
    const {tweetId} = request.params;
    console.log(tweetId);
    let {username} = request;

    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);

    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
   // console.log(getFollowingIdsArray);

    const getFollowingIds = getFollowingIdsArray.map(eachFollower => {
    return eachFollower.following_user_id

});
    console.log(getFollowingIds);

     const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
   const getTweetIdsArray = await db.all(getTweetIdsQuery);
   const getTweetIds = getTweetIdsArray.map((eachTweet) => {
    return eachTweet.twet_id;
});
   console.log(getTweetIds);

   if (getTweetIds.includes(parseInt(tweetId))) {

    const getUsernameReplyTweetsQuery = `SELECT user.name, reply.reply FROM user INNER JOIN reply ON user.user_id=reply.user_id
    WHERE reply.tweet_id = ${tweetId};`;
    const getUsernameReplyTweets = await db.all(getUsernameReplyTweetsQuery);

    response.send(convertUserNameReplyedDBObjectToResponseObject(getUsernameReplyTweets)
    );
   } else {
    response.status(401);
    response.send("Invalid Request");
   }
}
);

app.get("/user/tweets/", authenticateToken, async(request, response) => {
    let {username} = request;

    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId);

    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id=${getUserId.user_id};`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachId) => {
    return parseInt(eachId.twet_id);
});

console.log(getTweetIds);
});

app.post("/user/tweets/", authenticateToken, async(request, response) => {
    let {username} = request;

    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);
    const {tweet} = request.body;

    const currentDate = new Date();
    console.log(currentDate.toISOString().replace("T", " "));

    const postRequestQuery = `INSERT INTO tweet(tweet, user_id, date_time) VALUES ("${tweet}", ${getUserId.user_id}, "${currentDate}");`;

    const responseResult = await db.run(postRequestQuery);
    const tweet_id = responseResult.lastID;
    response.send("Created a Tweet");
});


app.delete("/tweets/:tweetId/", authenticateToken, async(request, response) => {
    const {tweetId} = request.params;
    
    let {username} = request;

    const getUserIdQuery = `SELECT user_id FROM user WHERE username="${username}";`;
    const getUserId = await db.get(getUserIdQuery);
    
    const getUserTweetsListQuery = `SELECT tweet_id FROM tweet WHERE user_id = ${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
        return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) [
        const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
        await db.run(deleteTweetQuery);
        response.send("Tweet Removed");
    ] else {
        response.status(401);
        response.send("Invalid Request");
    }
}
);

module.exports = app;