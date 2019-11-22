const packageJson = require('./package.json');
const program = require('commander');
const Promise = require('bluebird');
const prettyjson = require('prettyjson');

const trello = require('./trello');



program
  .version(packageJson.version)
  .usage('-k <trello-key> -t <trello-token> -b <trello-board> -i <commenter-id>')
  .option('-k, --trello-key <key>', 'Trello key')
  .option('-t, --trello-token <token>', 'Trello auth token')
  .option('-b, --trello-board <id>', 'Trello board ID')
  .option('-i, --trello-commenter-id <id>', 'Delete comments created by this Id')
  .option('-n, --no-commit', 'Calculate modifications but do not write them to Trello')
  .parse(process.argv);

if (!program.trelloKey ||
   !program.trelloToken ||
   !program.trelloBoard ||
   !program.trelloCommenterId) {
     program.help();
     return 0;
   }



trello.auth(program.trelloKey, program.trelloToken);



const allCardsP = trello.getCardsOnBoard(program.trelloBoard)
.map(card => trello.getCommentsOnCard(card.id)
.map(function(comment) {
  if (comment.idMemberCreator === program.trelloCommenterId) {
    console.log(`Will delete comment ${comment.id} on card \"${card.name}\"`);
    if (program.commit) {
      return trello.deleteCommentAsync(comment.id);
    }
  }
}));
