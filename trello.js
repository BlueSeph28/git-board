const Promise = require('bluebird');
const Trello = require('node-trello');



let trello = null;
const trelloRateDelay = 200;
let delays = Promise.resolve();

exports.auth = function(key, token) {
  trello = new Trello(key, token);
  return Promise.promisifyAll(trello);
};

var apiCall = function(log, request, arg0, arg1, retriesLeft) {
  if (arg1 == null) { arg1 = {}; }
  if (retriesLeft == null) { retriesLeft = 10; }
  const func = request.bind(trello);
  delays = delays.delay(trelloRateDelay);
  return delays.then(function() {
    console.log(log);
    if (retriesLeft === 0) {
      console.log('Exausted retries.');
      process.abort();
    }
    return func(arg0, arg1);}).catch(function(e) {
    console.log(log);
    if (e.code === '504') {
      console.log('504 error found, will retry');
      return apiCall(log, func, arg0, arg1, (retriesLeft - 1));
    } else {
      console.log(e);
      console.log(e.stack);
      return process.abort();
    }
  });
};



exports.getCardsOnBoard = boardId => apiCall(`Downloading all cards on board ${boardId}...`,
  trello.getAsync, '/1/boards/' + boardId + '/cards', {
    limit: 1000,
    fields: 'desc,name,shortUrl,idLabels,idList,due,dueComplete'
  }
);

exports.getCardsOnList = listId => apiCall(`Downloading all cards on list ${listId}...`,
  trello.getAsync, '/1/lists/' + listId + '/cards', {
    limit: 1000,
    fields: 'desc,name,shortUrl,idLabels,idList'
  }
);

exports.getLabelsOnBoard = boardId => apiCall(`Downloading all labels on board ${boardId}...`,
  trello.getAsync, '/1/boards/' + boardId + '/labels', {
    limit: 1000,
    fields: 'color,name'
  }
);

exports.getCommentsOnCard = cardId => apiCall(`Downloading all comments on card ${cardId}...`,
  trello.getAsync, '/1/cards/' + cardId + '/actions', {
    filter: 'commentCard',
    fields: 'data,idMemberCreator',
    limit: 1000,
    memberCreator: false
  }
);

exports.addCardAsync = function(listId, title, desc, due, dueState) {
  if (desc == null) { desc = ''; }
  return apiCall(`Adding card \"${title}\" to list ${listId}...`,
    trello.postAsync, '/1/cards', {
      name: title,
      idList: listId,
      desc,
      pos: 'top',
      due: due,
      dueComplete: dueState
    }
  );
};

exports.addLabelToBoardAsync = (boardId, name) => apiCall(`Adding label ${name} to board ${boardId}...`,
  trello.postAsync, '/1/boards/' + boardId + '/labels', {
    name,
    color: 'red'
  }
);

exports.addCommentToCardAsync = (cardId, comment) => apiCall(`Adding comment to card ${cardId}...`,
  trello.postAsync, '/1/cards/' + cardId + '/actions/comments',
    {text: comment});

exports.addLabelToCardAsync = (cardId, labelId) => apiCall(`Adding label to card ${cardId}...`,
  trello.postAsync, '/1/cards/' + cardId + '/idLabels',
    {value: labelId});

exports.updateCardDescriptionAsync = (cardId, desc) => apiCall(`Updating description of card ${cardId}...`,
  trello.putAsync, '/1/cards/' + cardId + '/desc',
    {value: desc});

exports.updateDueDateAsync = (cardId, date) => apiCall(`Adding due date to card ${cardId}...`,
  trello.putAsync, '/1/cards/' + cardId + '/due',
    {value: date});

exports.updateDueStateAsync = (cardId, state) => apiCall(`Adding due date to card ${cardId}...`,
    trello.putAsync, '/1/cards/' + cardId + '/dueComplete',
      {value: state});

exports.moveCardToListAsync = function(cardId, listId, pos) {
  if (pos == null) { pos = 'top'; }
  return apiCall(`Moving card ${cardId} to list ${listId}...`,
    trello.putAsync, '/1/cards/' + cardId + '/idList',
      {value: listId})
  .then(() => apiCall(`Setting card ${cardId} to position ${pos}...`,
    trello.putAsync, '/1/cards/' + cardId + '/pos',
      {value: pos}));
};

exports.archiveCardAsync = cardId => apiCall(`Archiving card ${cardId}...`,
  trello.putAsync, '/1/cards/' + cardId + '/closed',
    {value: true});

exports.getListsOnBoardAsync = boardId => apiCall(`Downloading information about lists on board ${boardId}...`,
  trello.getAsync, '/1/boards/' + boardId + '/lists');

exports.deleteCommentAsync = commentId => apiCall(`Deletting comment ${commentId}...`,
  trello.delAsync, '/1/actions/' + commentId);


exports.findListIdAsync = (listName, boardId) => exports.getListsOnBoardAsync(boardId)
.filter(list => list.name === listName)
.then(function(lists) {
  if (lists.length > 0) {
    return lists[0];
  } else {
    throw `Could not find list \"${listName}\" on board \"${boardId}\"`;
  }}).then(list => list.id);
