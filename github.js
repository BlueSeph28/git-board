const Promise = require('bluebird');
const GitHubApi = require('@octokit/rest');

const githubRateDelay = 200;
let delays = Promise.resolve();
var github = null;

var _apiCall = function(log, func, arg, retriesLeft) {
  _isAuthenticated();
  if (retriesLeft == null) { retriesLeft = 10; }
  delays = delays.delay(githubRateDelay);
  return delays.then(function() {
    console.log(log);
    if (retriesLeft === 0) {
      console.log("Exausted retries.");
      process.abort();
    }
    return func(arg);
  }).catch(function(e) {
    if ((e.code === '504') || (e.code === 504)) {
      console.log('504 error found, will retry');
      return _apiCall(log, func, arg, (retriesLeft - 1));
    } else if ((e.code === '404') || (e.code === 404)) {
      throw e;
    } else {
      console.log(e);
      return process.abort();
    }
  });
};

var _isAuthenticated = function() {
  if(github == null)
    throw "First authenticate with a token to access to github repositories.";
  return;
};

var _getAllPages = function(func, arg, filterFunc, acc, pageNumber) {
  if (filterFunc == null) { filterFunc = () => true; }
  if (acc == null) { acc = []; }
  if (pageNumber == null) { pageNumber = 1; }
  arg['per_page'] = 100;
  arg['page'] = pageNumber;
  return _apiCall(`Getting page ${pageNumber} ...`, func, arg)
  .then(function(res) {
    res = res.data;
    res = res.filter(filterFunc);
    console.log('Received page ' + pageNumber + ' containing ' + res.length + ' items.');
    // Single page for debug
    // return res;
    res.forEach(v => acc.push(v));
    if ((res.length === 0) || (res.length < 100)) {
      console.log('Done getting pages. Received ' + acc.length + ' items.');
      return acc;
    } else {
      return _getAllPages(func, arg, filterFunc, acc, pageNumber + 1);
    }
  });
};

exports.auth = function(token) {
  github = new GitHubApi({
    version: "3.0.0",
    debug: true,
    protocol: "https",
    host: "api.github.com",
    auth: token
  });
  Promise.promisifyAll(github.issues);
  return null;
};

exports.getIssueAndCommentsAsync = (githubUser, githubRepo, issueNumber) => _apiCall(`Downloading issue ${issueNumber}...`, github.issues.get, {
  owner: githubUser,
  repo: githubRepo,
  issue_number: issueNumber
}).then(function(issue) {
  if ((issue != null ? issue.status : undefined) !== 200) {
    console.log(`issue ${issueNumber} got status number ${issue.status}`);
    throw new Error();
  }
  issue = issue.data;
  console.log(`Downloading comments for issue ${issueNumber}...`);
  return _getAllPages(github.issues.listComments, {
    owner: githubUser,
    repo: githubRepo,
    issue_number: issue.number
  }).then(function(comments) {
    console.log(`Downloaded ${comments.length} comments for issue ${issue.number}.`);
    return {
      issue,
      comments
    };
  });
});

exports.milestoneFieldAsync = function(githubUser, githubRepo, milestoneName) {
  if(milestoneName) {
    return _getAllPages(github.issues.listMilestonesForRepo, {
      owner: githubUser,
      repo: githubRepo,
    }
    )
    .filter(milestone => milestone.title == milestoneName)
    .then(milestone => milestone[0].number);
  }
  else 
    return new Promise((resolver) => {
      resolver(null);
    });
};

exports.openIssuesAndCommentsAsync = function(githubUser, githubRepo, milestone, issue_filter) {
  _isAuthenticated();
  if (issue_filter == null) { issue_filter = () => true; }
  let args = {
    owner: githubUser,
    repo: githubRepo,
    state: "all"
  };
  if(milestone != null)
    args.milestone = milestone;

  console.log("Downloading issues...");
  return _getAllPages(github.issues.listForRepo, args).filter(issue_filter)
  .then(function(issues) {
    console.log(`Downloaded ${issues.length} issues.`);
    console.log("Downloading comments for all open issues...");
    return issues;}).map(issue => _getAllPages(github.issues.listComments, {
    owner: githubUser,
    repo: githubRepo,
    issue_number: issue.number
  }).then(function(comments) {
    console.log(`Downloaded ${comments.length} comments for issue ${issue.number}.`);
    return {
      issue,
      comments
    };
  }));
};
