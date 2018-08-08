// @flow

import stream from 'getstream';
import faker from 'faker';

import type { UserSession, CloudClient } from '../types';

async function main() {
  let apiKey = process.env['STREAM_API_KEY'] || '';
  let apiSecret = process.env['STREAM_API_SECRET'] || '';
  let appId = process.env['STREAM_APP_ID'] || '';
  let apiUrl = process.env['STREAM_API_URL'];

  console.log(apiKey, apiSecret, apiUrl);
  let client: CloudClient = stream.connectCloud(apiKey, appId, {
    urlOverride: {
      api: apiUrl,
    },
    keepAlive: false,
  });

  function createUserSession(userId): UserSession {
    return client.createUserSession(
      userId,
      stream.signing.JWTUserSessionToken(apiSecret, userId),
    );
  }

  let batman = createUserSession('batman');
  let fluff = createUserSession('fluff');
  let league = createUserSession('justiceleague');
  let bowie = createUserSession('davidbowie');

  await batman.user.getOrCreate({
    name: 'Batman',
    url: 'batsignal.com',
    desc: 'Smart, violent and brutally tough solutions to crime.',
    profileImage:
      'https://i.kinja-img.com/gawker-media/image/upload/s--PUQWGzrn--/c_scale,f_auto,fl_progressive,q_80,w_800/yktaqmkm7ninzswgkirs.jpg',
    coverImage:
      'https://i0.wp.com/photos.smugmug.com/Portfolio/Full/i-mwrhZK2/0/ea7f1268/X2/GothamCity-X2.jpg?resize=1280%2C743&ssl=1',
  });

  await fluff.user.getOrCreate({
    name: 'Fluff',
    url: 'fluff.com',
    desc: 'Sweet I think',
    profileImage:
      'https://mylittleamerica.com/988-large_default/durkee-marshmallow-fluff-strawberry.jpg',
    coverImage: '',
  });

  await league.user.getOrCreate({
    name: 'Justice League',
    profileImage:
      'http://www.comingsoon.net/assets/uploads/2018/01/justice_league_2017___diana_hq___v2_by_duck_of_satan-db3kq6k.jpg',
  });

  await bowie.user.getOrCreate({
    name: 'David Bowie',
    profileImage:
      'http://www.officialcharts.com/media/649820/david-bowie-1100.jpg?',
  });

  let randomUsers = [];
  let randomUsersPromises = [];
  for (let i = 0; i < 30; i++) {
    let session = createUserSession(`random-${i}`);
    randomUsers.push(session);
    randomUsersPromises.push(
      session.user.getOrCreate({
        name: faker.name.findName(),
        profileImage: faker.internet.avatar(),
        desc: faker.lorem.sentence(),
      }),
    );
  }
  await Promise.all(randomUsersPromises);

  await batman.followUser(fluff.user);
  await batman.followUser(bowie.user);
  await batman.followUser(league.user);
  await league.followUser(batman.user);

  let fluffActivity = await fluff.feed('user').addActivity({
    foreign_id: 'fluff-2',
    time: '2018-07-19T13:23:47',

    actor: fluff.user,
    verb: 'comment',
    object: fluff.user,

    content: 'Great podcast with @getstream and @feeds! Thanks guys!',
  });

  let wonderWomenActivity = await league.feed('user').addActivity({
    foreign_id: 'league-2',
    time: '2018-07-19T13:15:12',

    actor: league.user,
    verb: 'post',
    object: '-',

    content: 'Wonder Woman is going to be great!',
    image:
      'http://www.comingsoon.net/assets/uploads/2018/01/justice_league_2017___diana_hq___v2_by_duck_of_satan-db3kq6k.jpg',
  });
  let response;

  try {
    response = await bowie.storage('podcast').add('hello-world-podcast', {
      title: 'Hello World',
      description: 'This is ground control for mayor Tom',
    });
  } catch (e) {
    response = await bowie.storage('podcast').get('hello-world-podcast');
  }

  let podcast = bowie.objectFromResponse(response);

  let bowieActivity = await bowie.feed('user').addActivity({
    foreign_id: 'bowie-2',
    time: '2018-07-19T13:12:29',

    actor: bowie.user,
    verb: 'repost',
    object: podcast,

    content: 'Great podcast with @getstream and @feeds! Thanks guys!',
  });
  response = await batman.feed('timeline').get({
    withReactionCounts: true,
    withOwnReactions: true,
    withRecentReactions: true,
  });
  console.log(response.results[0].reaction_counts);
  console.log(response.results[0].own_reactions);
  console.log(response.results[0].latest_reactions);

  await ignore409(() =>
    Promise.all(
      randomUsers
        .slice(1, 20)
        .map((user, i) =>
          user.react('heart', fluffActivity, { id: `random-heart-fluff-${i}` }),
        ),
    ),
  );

  await ignore409(() =>
    Promise.all(
      randomUsers.slice(1, 5).map((user, i) =>
        user.react('repost', fluffActivity, {
          id: `random-repost-fluff-${i}`,
        }),
      ),
    ),
  );

  await ignore409(() =>
    Promise.all(
      randomUsers.slice(7, 9).map((user, i) =>
        user.react('comment', fluffActivity, {
          id: `random-comment-fluff-${i}`,
          data: {
            text: `Oh yeah! ${(user.user.data || {}).name ||
              'Unknown'} loves this!`,
          },
        }),
      ),
    ),
  );

  await ignore409(() =>
    Promise.all(
      randomUsers.slice(22, 26).map((user, i) =>
        user.react('heart', wonderWomenActivity, {
          id: `random-heart-wonderwomen-${i}`,
        }),
      ),
    ),
  );

  await ignore409(() =>
    Promise.all(
      randomUsers.slice(22, 26).map((user, i) =>
        user.react('heart', wonderWomenActivity, {
          id: `random-heart-wonderwomen-${i}`,
        }),
      ),
    ),
  );

  await ignore409(() =>
    Promise.all(
      randomUsers.slice(12, 19).map((user, i) =>
        user.react('comment', bowieActivity, {
          id: `random-comment-bowie-${i}`,
          data: {
            text: `${(user.user.data || {}).name ||
              'Unknown'} thinks this is the best podcast ever!`,
          },
        }),
      ),
    ),
  );

  await ignore409(async () => {
    await batman.react('heart', fluffActivity, { id: `batman-heart-fluff` });
  });
}
main();

async function ignore409(asyncfn) {
  try {
    await asyncfn();
  } catch (e) {
    if (
      !(e instanceof stream.errors.StreamApiError) ||
      e.response.statusCode != 409
    ) {
      throw e;
    }
  }
}