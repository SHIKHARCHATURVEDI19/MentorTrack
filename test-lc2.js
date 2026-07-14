const fetch = require('node-fetch');

async function test(query) {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query, variables: { username: 'shikharchaturvedi19' } })
  });
  if (res.ok) console.log(JSON.stringify(await res.json(), null, 2));
  else console.log(res.status, await res.text());
}

// Top level userCalendar?
const q1 = `
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      userCalendar(year: 2024) {
        streak
      }
    }
  }
`;

// Another format?
const q2 = `
  query getUserProfile($username: String!) {
    userCalendar(username: $username) {
      streak
    }
  }
`;

test(q1).then(() => test(q2));
