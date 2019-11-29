exports.normalize = s => s.replace(/\r\n/g, '\n')
 .replace(/\r/g, '\n')
 .replace(/<!--[\s\S]*?-->\n*/gm, '')
 .replace(/>due: .{8,27}/g, '')
 .trim();

const truncateLength = 800;

const parseTitle = function(issue, user, repo) {
  const type = issue.hasOwnProperty('pull_request') ? 'PR' : 'I';
  //"[#{user}/#{repo}: \##{issue.number}] #{issue.title}"
  //"[#{repo}] #{issue.title} (\##{issue.number})"
  return `${issue.title} (${type} \#${issue.number})`;
};

const parseDesc = function(issue) {
  const type = issue.hasOwnProperty('pull_request') ? 'PR' : 'I';
  let desc = `URL: ${issue.html_url}\n`;
  const cleantitle = issue.title.replace(/`/g, '\'');
  desc = desc + `\`**${cleantitle} ([${type} \#${issue.number}])**  \`\n`;
  if (issue.closed_by && issue.closed_at) {
    desc = desc + `:x: Issue closed by [${issue.closed_by.login}](${issue.closed_by.html_url}) on ${new Date(issue.closed_at).toDateString()}\n`;
  }
  desc = desc +
         `Created on: ${new Date(issue.created_at).toDateString()}\n` +
         `Created by: [${issue.user.login}](${issue.user.html_url})\n` +
         `Labels: ${(Array.from(issue.labels).map((label) => label.name)).join(' ')}\n` +
         "\n" +
         "---\n" +
         exports.normalize(issue.body);
  if (desc.length > truncateLength) {
    desc = desc.slice(0, truncateLength) + "\n\n---\nTRUNCATED";
  }
  return desc.trim();
};

const parseDue = function(issue) {
  let rawDate = issue.body.match(/>due: .{8,27}/g);
  let date = null;
  if(rawDate){
    rawDate = rawDate[0].substring(6);
    date = new Date(rawDate);
    date.setDate(date.getDate());
  }
  return date;
};

const parseDueState = function(issue) {
  return issue.state == 'closed';
};


const parseIssue = (issue, user, repo) => ({
  title: parseTitle(issue, user, repo),
  desc: parseDesc(issue, user, repo)
});

const parseComment = function(comment) {
  let ret = `:octocat: [${comment.user.login}](${comment.user.html_url}) on ${new Date(comment.updated_at).toDateString()}\n` +
        "\n" +
        "---\n" +
        exports.normalize(comment.body);
  if (ret.length > truncateLength) {
    ret = ret.slice(0, truncateLength) + "\n\n---\nTRUNCATED";
  }
  return ret;
};

const parseComments = comments => comments.map(parseComment);

const parseLabels = function(issue, labels) {
  const issueText = exports.normalize(JSON.stringify(issue))
    .toUpperCase();
  return (() => {
    const result = [];
    for (let label of Array.from(labels)) {
      if(issue.issue.labels.find(element => element.name == label)) {
        result.push(label);
      }
    }
    if(issue.issue.state == "closed") {
      result.push('CLOSED');
    }
    return result;
  })();
};

const parseMentions = function(issue, labels) {
  const ret = [];
  for (let comment of Array.from(issue.comments)) {
    var commentText = JSON.stringify(comment).toUpperCase();
    const mentions = ((() => {
      const result = [];
      for (let label of Array.from(labels)) {         if (commentText.indexOf(label.toUpperCase()) > -1) {
          result.push(label);
        }
      }
      return result;
    })());
    if (mentions) {
      for (let mention of Array.from(mentions)) {
        if (comment.user.login !== mention) {
          ret.push({
            text: `:bangbang: ${mention} [was mentioned](${comment.html_url}) by [${comment.user.login}](${comment.user.html_url}) on ${new Date(comment.updated_at).toDateString()}`,
            mention,
            html_url: comment.html_url,
            user: {
              login: comment.user.login,
              html_url: comment.user.html_url
            }
          });
        }
      }
    }
  }
  return ret;
};


exports.numberFromDesc = (user, repo) => (function(desc) {
  const lines = desc.match(/^.*$/m);
  if (!lines) { return null; }
  if (!(lines.length >= 1)) { return null; }
  const info = lines[0].match(new RegExp(`^\
URL: https://github.com/${user}/${repo}/.*/([0-9]+)\
$`)
  );
  if (!info) { return null; }
  return parseInt(info[1]);
});


exports.parseFullIssue = (user, repo, labels, warnKeywords) => (function(issue) {
  const ret = parseIssue(issue.issue);
  // Sanity check
  if (issue.issue.number !== exports.numberFromDesc(user, repo)(ret.desc)) {
    console.log('===== DESC =====');
    console.log(ret.desc);
    console.log('================');
    throw "ERROR: Number can't be extracted from parsed description";
  }
  ret.comments = parseComments(issue.comments);
  ret.labels = parseLabels(issue, labels);
  ret.mentions = parseMentions(issue, warnKeywords);
  ret.dueDate = parseDue(issue.issue);
  ret.dueState = parseDueState(issue.issue);
  return ret;
});
