let openIssuesAndCommentsP;
const packageJson = require('./package.json');
const program = require('commander');
const Promise = require('bluebird');
const PromiseQueue = require('promise-queue');
PromiseQueue.configure(Promise);
const prettyjson = require('prettyjson');

const github = require('./github');
const trello = require('./trello');
const textgen = require('./textgen');



const collect = function(val, memo) {
  memo.push(val);
  return memo;
};
program
  .version(packageJson.version)
  .usage('-u <github-user> -r <github-repo> [-g github-token] -k <trello-key> -t <trello-token> -b <trello-board> [KEYWORDS...]')
  .option('-u, --github-user <user>', 'Github user or organization hosting the repository')
  .option('-r, --github-repo <repo>', 'Github repository name')
  .option('-m, --milestone-name <milestone>', 'Milestone to syncronize')
  .option('-g, --github-token <repo>', 'optional Github OAuth2 token')
  .option('-k, --trello-key <key>', 'Trello key')
  .option('-t, --trello-token <token>', 'Trello auth token')
  .option('-b, --trello-board <id>', 'Trello board ID')
  .option('-a, --archive-from-inbox', 'Archive cards for closed issues in inbox')
  .option('-p, --include-pull-requests', 'Include pull requests')
  .option('-f, --full-text', 'Reproduce full issue text on trello')
  .option('-n, --no-commit', 'Download and calculate modifications but do not write them to Trello')
  .option('-w, --warn <KEYWORD>', 'Warn about mentions of KEYWORD', collect, [])
  .parse(process.argv);

if (!program.githubUser ||
   !program.githubRepo ||
   !program.trelloKey ||
   !program.trelloToken ||
   !program.trelloBoard) {
     program.help();
     return 0;
   }
   

trello.auth(program.trelloKey, program.trelloToken);
if (program.githubToken != null) { github.auth(program.githubToken); }

   github.milestoneFieldAsync(program.githubUser, program.githubRepo, program.milestoneName).then(milestone => {
    const toDoListIdP = trello.findListIdAsync('To do', program.trelloBoard);
    const inProgressListIdP = trello.findListIdAsync('In progress', program.trelloBoard);
    const doneListIdP = trello.findListIdAsync('Done', program.trelloBoard);
    
    toDoListIdP.then(function(toDoListId) {
      inProgressListIdP.then(function(inProgressListId) {
        doneListIdP.then(function(doneListId) {
const keywords = program.args;

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
  };}).then(function(res) { require('jsonfile').writeFileSync('cache_labelsP.json', res);  return res; });

let totalIssuesOnTrello = 1000000;
let totalIssuesToCreate = 1000000;
let totalIssuesToMove = 1000000;
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
.then(function(res) { 
  require('jsonfile').writeFileSync('cache_allCardsP.json', res);  return res; 
});
  if (program.includePullRequests) {
    openIssuesAndCommentsP = github.openIssuesAndCommentsAsync(program.githubUser, program.githubRepo, milestone);
  } else {
    openIssuesAndCommentsP = github.openIssuesAndCommentsAsync(program.githubUser, program.githubRepo, milestone, issue => !issue.hasOwnProperty('pull_request'));
  }
openIssuesAndCommentsP.tap(res => require('jsonfile').writeFileSync('cache_openIssuesAndCommentsP.json', res));

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
.then(function(res) { require('jsonfile').writeFileSync('cache_fullDownloadP.json', res);  return res; });

const checkIssuesP = fullDownloadP
.tap(() => totalIssuesToCreate = 0)
.tap(issues => console.log(`Before filtering not found issues: ${issues.length}`))
.filter(issue => !issue.github.issueNotFound)
.tap(issues => console.log(`After filtering not found issues: ${issues.length}`))
.each(function(issue) {
  issue.parsed = textgen.parseFullIssue(program.githubUser, program.githubRepo, keywords, program.warn)(issue.github);
  if (issue.trello) {
    // Possible update
    if (issue.trello.card.desc !== issue.parsed.desc) { issue.updateDesc = true; }
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
    // Possible closed and archive
    if ((issue.github.issue != null ? issue.github.issue.state : undefined) === 'closed') {
      if (!Array.from(issue.trello.labels).includes('CLOSED')) {
        if (issue.newLabels) {
          issue.newLabels.push('CLOSED');
        } else {
          issue.newLabels = ['CLOSED'];
        }
      }
      if (issue.trello.inbox) { return issue.archive = true; }
    }
  } else {
    // New issue
    if (issue.parsed.labels.length || !keywords.length) {
      issue.create = true;
      return totalIssuesToCreate++;
    }
  }}).tap(function(issues) {
  let issue;
  console.log('');
  console.log('');
  console.log(`Total number of cards currently on Trello: ${totalIssuesOnTrello}`);
  console.log(`Total number of cards to move: ${totalIssuesToMove}`);
  console.log(`Number of cards to create now: ${totalIssuesToCreate}`);
  if ((totalIssuesOnTrello + totalIssuesToCreate) > maxCards) {
    console.log('ERROR: Creating more issues will break the Trello API. A workaround must be found and implemented.');
  }
  console.log('');
  console.log('');
  console.log('========== NEW ISSUES ==========');
  for (issue of Array.from(issues)) {
    if (issue.create) {
      console.log(`${issue.parsed.title}`);
    }
  }
  console.log('');
  console.log('');
  console.log('========== UPDATED ISSUES ==========');
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
      console.log('');
    }
  }
  console.log('\n\n========== CLOSED ISSUES ==========');
  for (issue of Array.from(issues)) {
    if (issue.archive) {
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
        console.log('Creating more issues will break the Trello API. A workaround must be found and implemented.');
        return null;
      } else if (issue.create) {
        let listIdP;
          if(issue.github.issue.state === "open")
            listIdP = toDoListIdP;
          else
            listIdP = doneListIdP;
        return listIdP
        .then(function(inboxListId) {
          console.log(`Adding issue \"${issue.parsed.title}\"`);

          return trello.addCardAsync(inboxListId, issue.parsed.title, issue.parsed.desc);}).tap(function(card) {
          let newComments = (Array.from(issue.parsed.mentions).map((mention) => mention.text));
          if (newComments.length) { newComments = [newComments.reverse().join('\n')]; }
          if (program.fullText) {
            newComments = newComments.concat(issue.parsed.comments);
          }
          enqueueAddComments(card.id, issue.parsed.title, newComments);
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
    if (issue.newComments) {
      enqueueAddComments(issue.trello.card.id, issue.parsed.title, issue.newComments);
    }
    if (issue.newLabels) {
      issue.newLabels.forEach(newLabel => queue.add(() => labelsP.then(function(trelloLabels) {
        console.log(`Adding new label \"${newLabel}\" to issue \"${issue.trello.card.name}\"`);
        return trello.addLabelToCardAsync(issue.trello.card.id, trelloLabels.nameToId[newLabel]);})));
    }
    if (issue.archive && program.archiveFromInbox) {
      console.log(`Archiving card \"${issue.trello.card.name}\"`);
      trello.archiveCardAsync(issue.trello.card.id);
    }
    return null;
  });
}
        });
      });
    });
});