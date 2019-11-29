let openIssuesAndCommentsP;
const packageJson = require('./package.json');
const program = require('commander');
const Promise = require('bluebird');
const PromiseQueue = require('promise-queue');
const fs = require('fs');
const crypto = require('crypto');
PromiseQueue.configure(Promise);
var readlineSync = require('readline-sync');

const github = require('./github');
const trello = require('./trello');
const textgen = require('./textgen');

const cipherAlgorithm = "aes-256-ctr";

const collect = function(val, memo) {
  memo.push(val);
  return memo;
};
program
  .version(packageJson.version)
  .usage('-u <github-user> -r <github-repo> [-g github-token] -k <trello-key> -t <trello-token> -b <trello-board> [KEYWORDS...]')
  .option('-e, --env <file>', 'Get environment variables from a file')
  .option('-p, --password <password>', 'Password for environtment file')
  .option('-u, --github-user <user>', 'Github user or organization hosting the repository')
  .option('-r, --github-repo <repo>', 'Github repository name')
  .option('-m, --milestone-name <milestone>', 'Milestone to syncronize')
  .option('-l, --in-progress-label <label>', 'Label for in progress issue identify - Default: In Progress')
  .option('-g, --github-token <repo>', 'optional Github OAuth2 token')
  .option('-k, --trello-key <key>', 'Trello key')
  .option('-t, --trello-token <token>', 'Trello auth token')
  .option('-b, --trello-board <id>', 'Trello board ID')
  .option('-p, --include-pull-requests', 'Include pull requests')
  .option('-f, --full-text', 'Reproduce full issue text on trello')
  .option('-c, --create-config <name>', 'Create config file specifying name')
  .option('-n, --no-commit', 'Download and calculate modifications but do not write them to Trello')
  .option('-w, --warn <KEYWORD>', 'Warn about mentions of KEYWORD', collect, [])
  .parse(process.argv);

var keywords = program.args;

if(program.env) {
  let rawData = JSON.parse(fs.readFileSync(program.env));

  if(rawData.encrypted) {
    let password = "";

    if(program.password)
      password = program.password;
    else
      password = readlineSync.question('Password: ', {
        hideEchoBack: true
      });

    let decipher = crypto.createDecipher(cipherAlgorithm,password);

    let dec = decipher.update(rawData.githubUser,'hex','utf8');
    dec += decipher.final('utf8')
    program.githubUser = dec;

    decipher = crypto.createDecipher(cipherAlgorithm,password)
    dec = decipher.update(rawData.githubRepo,'hex','utf8');
    dec += decipher.final('utf8')
    program.githubRepo = dec;

    decipher = crypto.createDecipher(cipherAlgorithm,password)
    dec = decipher.update(rawData.githubToken,'hex','utf8');
    dec += decipher.final('utf8')
    program.githubToken = dec;

    decipher = crypto.createDecipher(cipherAlgorithm,password)
    dec = decipher.update(rawData.trelloKey,'hex','utf8');
    dec += decipher.final('utf8')
    program.trelloKey = dec;

    decipher = crypto.createDecipher(cipherAlgorithm,password)
    dec = decipher.update(rawData.trelloToken,'hex','utf8');
    dec += decipher.final('utf8')
    program.trelloToken = dec;

    decipher = crypto.createDecipher(cipherAlgorithm,password)
    dec = decipher.update(rawData.trelloBoard,'hex','utf8');
    dec += decipher.final('utf8')
    program.trelloBoard = dec;
  }
  else {
    program.githubUser = rawData.githubUser;
    program.githubRepo = rawData.githubRepo;
    program.githubToken = rawData.githubToken;
    program.trelloKey = rawData.trelloKey;
    program.trelloToken = rawData.trelloToken;
    program.trelloBoard = rawData.trelloBoard;
  }

  if(rawData.milestoneName)
    program.milestoneName = rawData.milestoneName;

  if(rawData.inProgressLabel)
    program.inProgressLabel = rawData.inProgressLabel;

  if(rawData.includePullRequests)
    program.includePullRequests = rawData.includePullRequests;

  if(rawData.fullText)
    program.fullText = rawData.fullText;

  if(rawData.noCommit)
    program.noCommit = rawData.noCommit;

  if(rawData.warn)
    program.warn = rawData.warn;

  if(rawData.keywords)
    keywords = rawData.keywords;
}

if (!program.githubUser ||
  !program.githubRepo ||
  !program.trelloKey ||
  !program.trelloToken ||
  !program.trelloBoard) {
    program.help();
    return 0;
}

if(program.createConfig){
  let password = "";
  let objectToWrite = {};

  if(program.password)
      password = program.password;
  else {
    let password = readlineSync.question('Insert a password for your keys: ', {
      hideEchoBack: true
    });

    let repeatPassword = readlineSync.question('Repeat your password: ', {
      hideEchoBack: true
    });

    if(password != repeatPassword){
      console.log("Passwords doens't match");
      return 0;
    }
  }

  let cipher = crypto.createCipher(cipherAlgorithm,password);

  let dec = cipher.update(program.githubUser,'utf8','hex');
  dec += cipher.final('hex');
  objectToWrite.githubUser = dec;

  cipher = crypto.createCipher(cipherAlgorithm,password)
  dec = cipher.update(program.githubRepo,'utf8','hex');
  dec += cipher.final('hex');
  objectToWrite.githubRepo = dec;

  cipher = crypto.createCipher(cipherAlgorithm,password)
  dec = cipher.update(program.trelloKey,'utf8','hex');
  dec += cipher.final('hex');
  objectToWrite.trelloKey = dec;

  cipher = crypto.createCipher(cipherAlgorithm,password)
  dec = cipher.update(program.trelloToken,'utf8','hex');
  dec += cipher.final('hex');
  objectToWrite.trelloToken = dec;

  cipher = crypto.createCipher(cipherAlgorithm,password)
  dec = cipher.update(program.trelloBoard,'utf8','hex');
  dec += cipher.final('hex');
  objectToWrite.trelloBoard = dec;

  if(program.milestoneName)
    objectToWrite.milestoneName = program.milestoneName;
  if(program.inProgressLabel)
    objectToWrite.inProgressLabel = program.inProgressLabel;
  if(program.githubToken){
    cipher = crypto.createCipher(cipherAlgorithm,password)
    dec = cipher.update(program.githubToken,'utf8','hex');
    dec += cipher.final('hex');
    objectToWrite.githubToken = dec;
  }
  objectToWrite.includePullRequests = program.includePullRequests ? true : false;
  objectToWrite.fullText = program.fullText ? true : false;
  objectToWrite.noCommit = program.noCommit ? true : false;

  objectToWrite.keywords = program.args;

  if(program.warn)
    objectToWrite.warn = program.warn;
  objectToWrite.encrypted = true;

  fs.writeFile(program.createConfig, JSON.stringify(objectToWrite), function(err) {

    if(err) {
        return console.log(err);
    }

    console.log(`Config file was created as ${program.createConfig}`);
  }); 
}


if(!program.inProgressLabel)
   program.inProgressLabel = "In Progress";
   

trello.auth(program.trelloKey, program.trelloToken);
if (program.githubToken != null) { github.auth(program.githubToken); }

   github.milestoneFieldAsync(program.githubUser, program.githubRepo, program.milestoneName).then(milestone => {
    const toDoListIdP = trello.findListIdAsync('To do', program.trelloBoard);
    const inProgressListIdP = trello.findListIdAsync('In progress', program.trelloBoard);
    const doneListIdP = trello.findListIdAsync('Done', program.trelloBoard);
    
    toDoListIdP.then(function(toDoListId) {
      inProgressListIdP.then(function(inProgressListId) {
        doneListIdP.then(function(doneListId) {

const labelsP = trello.getLabelsOnBoard(program.trelloBoard)
.then(function(labels) {
  let label;
  const expectedLabels = keywords.concat(['CLOSED']);
  const missingLabels = ((() => {
    const result = [];
    for (var keyword of Array.from(expectedLabels)) {
      if (!labels.some(label => label.name === keyword)) {
        result.push(keyword);
      }
    }
    return result;
  })());
  return Promise.map(missingLabels, function(missingLabel) {
    console.log(`Adding missing label ${missingLabel}...`);
    return trello.addLabelToBoardAsync(program.trelloBoard, missingLabel)
    .tap(label => labels.push(label));
}).then(() => labels);}).then(function(labels) {
  const nameToId = {};
  const idToName = {};
  for (let label of Array.from(labels)) {
    nameToId[label.name] = label.id;
    idToName[label.id] = label.name;
  }
  return {
    nameToId,
    idToName
  };}).then(res => res);

let totalIssuesOnTrello = 0;
let totalIssuesToCreate = 0;
let totalIssuesToMove = 0;
const maxCards = 900;

const allCardsP = trello.getCardsOnBoard(program.trelloBoard)
.then(cards => labelsP.then(trelloLabels => {

  totalIssuesOnTrello = cards.length;
  const trelloItems = [];
  for (let card of Array.from(cards)) {
    const number = textgen.numberFromDesc(program.githubUser, program.githubRepo)(card.desc);
    card.desc = textgen.normalize(card.desc);
    const labels = (Array.from(card.idLabels).map((idLabel) => trelloLabels.idToName[idLabel]));
    if (number) { trelloItems.push({ number, card, labels, toDo: (card.idList === toDoListId), inProgress: (card.idList === inProgressListId), done: (card.idList === doneListId) }); }
  }

  return trelloItems;
}))
.map(trelloItem => trello.getCommentsOnCard(trelloItem.card.id)
.map(comment => textgen.normalize(comment.data.text))
.then(function(comments) {
  trelloItem.comments = comments;
  return trelloItem;
}))
.then(res => res);
  if (program.includePullRequests) {
    openIssuesAndCommentsP = github.openIssuesAndCommentsAsync(program.githubUser, program.githubRepo, milestone);
  } else {
    openIssuesAndCommentsP = github.openIssuesAndCommentsAsync(program.githubUser, program.githubRepo, milestone, issue => !issue.hasOwnProperty('pull_request'));
  }

const fullDownloadP = Promise.resolve({})
.then(data => allCardsP.then(trelloItems => openIssuesAndCommentsP.then(function(githubItems) {
  for (let trelloItem of Array.from(trelloItems)) {
    if (data[trelloItem.number] == null) { data[trelloItem.number] = { number: trelloItem.number }; }
    data[trelloItem.number].trello = trelloItem;
  }
  return (() => {
    const result = [];
    for (let githubItem of Array.from(githubItems)) {
      if (data[githubItem.issue.number] == null) { data[githubItem.issue.number] = { number: githubItem.issue.number }; }
      result.push(data[githubItem.issue.number].github = githubItem);
    }
    return result;
  })();
})).then(() => data)).then(function(data) {
  let number;
  return Promise.resolve(((() => {
    const result = [];
    for (number in data) {
      const info = data[number];
      if (info.trello && !info.github) {
        result.push(number);
      }
    }
    return result;
  })()))
  .map(number => github.getIssueAndCommentsAsync(program.githubUser, program.githubRepo, number)
  .then(githubItem => data[number].github = githubItem).catch(() => data[number].github = { issueNotFound: true }))
  .then(() => data);}).then(data => (() => {
    const result = [];
    for (let number in data) {
      const info = data[number];
      result.push(info);
    }
    return result;
  })())
.then(res => res);

const checkIssuesP = fullDownloadP
.tap(() => totalIssuesToCreate = 0)
.tap(issues => console.log(`Before filtering not found issues: ${issues.length}`))
.filter(issue => !issue.github.issueNotFound)
.tap(issues => console.log(`After filtering not found issues: ${issues.length}`))
.each(function(issue) {
  issue.parsed = textgen.parseFullIssue(program.githubUser, program.githubRepo, keywords, program.warn)(issue.github);
  if (issue.trello) {

    let isInProgress = issue.github.issue.labels.find(element => element.name == program.inProgressLabel);

    if(isInProgress && !issue.trello.inProgress) {
      totalIssuesToMove++;
      issue.move = true;
      trello.moveCardToListAsync(issue.trello.card.id, inProgressListId, 0).then(() => {
        console.log(`Card ${issue.trello.card.id} moved`);
      });
    }
    else if(!isInProgress && issue.github.issue.state == 'open' && !issue.trello.toDo) {
      totalIssuesToMove++;
      issue.move = true;
      trello.moveCardToListAsync(issue.trello.card.id, toDoListId, 0).then(() => {
        console.log(`Card ${issue.trello.card.id} moved`);
      });
    }
    else if(issue.github.issue.state == 'closed' && !issue.trello.done) {
      totalIssuesToMove++;
      issue.move = true;
      trello.moveCardToListAsync(issue.trello.card.id, doneListId, 0).then(() => {
      console.log(`Card ${issue.trello.card.id} moved`);
      });
    }
    else 
    issue.move = false;
    if (issue.trello.card.desc !== issue.parsed.desc) issue.updateDesc = true;
    // Check, everytime is updating the dueDate
    if((!issue.trello.card.due && issue.parsed.dueDate) || (issue.trello.card.due && new Date(issue.trello.card.due) != issue.parsed.dueDate)) issue.updateDue = true;
    if(issue.parsed.dueState != issue.trello.card.dueComplete) issue.updateDueState = true;
    let newComments = [];
    for (let mention of Array.from(issue.parsed.mentions)) {
      if (JSON.stringify(issue.trello.comments).indexOf(mention.html_url) < 0) {
        newComments.push(mention.text);
      }
    }
    if (newComments.length) { newComments = [newComments.reverse().join('\n')]; }
    if (program.fullText) {
      newComments = newComments.concat((Array.from(issue.parsed.comments).filter((comment) => !Array.from(issue.trello.comments).includes(comment))));
    }
    if (newComments.length) { issue.newComments = newComments; }
    const newLabels = (Array.from(issue.parsed.labels).filter((label) => !Array.from(issue.trello.labels).includes(label)));
    if (newLabels.length) { issue.newLabels = newLabels; }
  } else {
    if (issue.parsed.labels.length || !keywords.length) {
      issue.create = true;
      return totalIssuesToCreate++;
    }
  }
}).tap(function(issues) {
  let issue;
  console.log(`\n\nTotal number of cards currently on Trello: ${totalIssuesOnTrello}`);
  console.log(`Total number of cards to move: ${totalIssuesToMove}`);
  console.log(`Number of cards to create now: ${totalIssuesToCreate}`);
  if ((totalIssuesOnTrello + totalIssuesToCreate) > maxCards) {
    console.log('ERROR: Cannot create more issues, you\'ve reached max of cards.');
  }
  console.log('\n\n========== NEW ISSUES ==========');
  for (issue of Array.from(issues)) {
    if (issue.create) {
      console.log(`${issue.parsed.title}`);
    }
  }
  console.log('\n\n========== UPDATED ISSUES ==========');
  for (issue of Array.from(issues)) {
    if (issue.updateDesc || issue.newComments || issue.newLabels) {
      console.log(`${issue.parsed.title}:`);
      if (issue.newComments) {
        console.log(`  - New comments: ${issue.newComments.length}`);
      }
      if (issue.newLabels) {
        console.log(`  - New labels: ${issue.newLabels.join(' ')}`);
      }
      if (issue.updateDesc) {
        console.log("  - Updated description:");
        console.log(issue.parsed.desc.replace(/^/mg, '      '));
      }
      if(issue.updateDue) {
        console.log("  - Updated due");
        console.log(issue.parsed.dueDate);
      }
      if(issue.updateDueState) {
        console.log("  - Updated due state");
        console.log("Updated to: " + issue.parsed.dueState ? "Completed" : "Pending");
      }
      console.log('');
    }
  }
  console.log('\n\n========== MOVED ISSUES ==========');
  for (issue of Array.from(issues)) {
    if (issue.move) {
      console.log(`${issue.parsed.title}`);
    }
  }
  console.log('');
  return console.log('');
});



if (program.commit) {
  const queue = new PromiseQueue;

  const enqueueAddComments = function(cardId, title, comments) {
    queue.add(() => Promise.reduce(comments, function(_, comment) {
      console.log(`Adding comment to issue \"${title}\": \"${comment}\"`);
      return trello.addCommentToCardAsync(cardId, comment);
    } // Promise.reduce waits for returned promises
    , null));
    return null;
  };

  checkIssuesP
  .tap(function(issues) {
    queue.add(() => Promise.reduce(issues, function(_, issue) {
      if ((totalIssuesOnTrello + totalIssuesToCreate) > maxCards) {
        console.log('ERROR: Cannot create more issues, you\'ve reached max of cards.');
        return null;
      } else if (issue.create) {
        let listIdP;
          if(issue.github.issue.labels.find(element => element.name == program.inProgressLabel))
            listIdP = inProgressListIdP;
          else if(issue.github.issue.state === "open")
            listIdP = toDoListIdP;
          else
            listIdP = doneListIdP;
        return listIdP
        .then(function(inboxListId) {
          console.log(`Adding issue \"${issue.parsed.title}\"`);
          return trello.addCardAsync(inboxListId, issue.parsed.title, issue.parsed.desc, issue.parsed.dueDate, issue.parsed.dueState);}).tap(function(card) {
          let newComments = (Array.from(issue.parsed.mentions).map((mention) => mention.text));
          if (newComments.length) { newComments = [newComments.reverse().join('\n')]; }
          if (program.fullText) {
            newComments = newComments.concat(issue.parsed.comments);
          }
          enqueueAddComments(card.id, issue.parsed.title, newComments);
          console.log(issue.parsed.labels);
          issue.parsed.labels.forEach(label => queue.add(() => labelsP.then(function(trelloLabels) {
            console.log(`Adding label \"${label}\" to issue \"${issue.parsed.title}\"`);
            return trello.addLabelToCardAsync(card.id, trelloLabels.nameToId[label]);})));
          return null;
        });
      }
    }
    , null));
    return null;}).each(function(issue) {
    if (issue.updateDesc) {
      queue.add(function() {
        console.log(`Updating description of issue \"${issue.trello.card.name}\"`);
        return trello.updateCardDescriptionAsync(issue.trello.card.id, issue.parsed.desc);
      });
    }
    console.log(issue.updateDue);
    if(issue.updateDue) {
      queue.add(function() {
        console.log(`Updating due of issue \"${issue.trello.card.name}\"`);
        return trello.updateDueDateAsync(issue.trello.card.id, issue.parsed.dueDate);
      });
    }
    if(issue.updateDueState) {
      queue.add(function() {
        console.log(`Updating due state of issue \"${issue.trello.card.name}\"`);
        return trello.updateDueStateAsync(issue.trello.card.id, issue.parsed.dueState);
      });
    }
    if (issue.newComments) {
      enqueueAddComments(issue.trello.card.id, issue.parsed.title, issue.newComments);
    }
    if (issue.newLabels) {
      issue.newLabels.forEach(newLabel => queue.add(() => labelsP.then(function(trelloLabels) {
        console.log(`Adding new label \"${newLabel}\" to issue \"${issue.trello.card.name}\"`);
        return trello.addLabelToCardAsync(issue.trello.card.id, trelloLabels.nameToId[newLabel]);})));
    }
    // trello.archiveCardAsync(issue.trello.card.id);
    return null;
  });
}
        });
      });
    });
});