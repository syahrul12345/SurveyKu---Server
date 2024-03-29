const {
  getAddress,
  deployContract,
  deployTracker,
  getTracker,
} = require('./deploy.js');
const { compileContract } = require('./utils/compiler.js');
const { interface, bytecode } = require('./utils/reference.js');
const fs = require('fs-extra');
const Web3 = require('web3');
const web3 = new Web3();
const express = require('express');
const bodyParser = require('body-parser');
const server = new express();
const port = 3334;

const TrackerAddresses = JSON.parse(fs.readFileSync('./utils/trackers.json'));
/**
@notice This is the defeault tracker address
@dev If you create a new Tracker, this is automatically updated.
**/
server.use(bodyParser());

server.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  );
  next();
});

server.get('/explorer', async (req, res) => {
  res.send(process.env.URL);
});

server.get('/getSurveyIds', async (req, res) => {
  console.log(TrackerAddresses.last())
  const trackerContract = await getTracker(
    interface,
    bytecode,
    TrackerAddresses.last(),
  );
  trackerContract.methods
    .getSurveyIds()
    .call({})
    .then(result => {
      res.send(result);
    });
});

/**
@notice Creats a new survey and populates accordingly with 
@dev Send a post request to this APi endpoint with format x-www
**/
server.post('/newSurvey', async (req, res) => {
  try {
    const survey = req.body;

    //how to store the data?
    // const surveyArray = splitString(JSON.stringify(survey), 256);
    // console.log(surveyArray);
    const title = survey.title;
    const questions = survey.questions;
    const promiseArray = [
      deployContract(compileContract('survey.sol'), title),
      getAddress(),
      getTracker(interface, bytecode, TrackerAddresses.last()),
    ];
    Promise.all(promiseArray).then(result => {
      surveyContract = result[0];
      trackerContract = result[2];
      surveyContractAddress = surveyContract.options.address;
      currentAccount = result[1];
      trackerContract.methods
        .addSurvey(surveyContractAddress)
        .send({
          from: currentAccount,
        })
        .then(async result => {
          const questionPromiseArray = [];
          questions.forEach(item => {
            const options = item.options;
            stringToBytes32(options).then(async result => {
              questionHex = await web3.utils.fromAscii(item.text);
              //result is in bytes32
              questionPromiseArray.push(
                surveyContract.methods
                  .createQuestion(questionHex, result)
                  .send({
                    from: currentAccount,
                    gas: 470000000,
                  }),
              );
            });
          });
          Promise.all(questionPromiseArray).then(result => {
            res.send('Survey Succesfully added to tracker');
            res.end();
          });
        });
    });
  } catch (ex) {
    res.status(500).send(ex.toString());
  }
});
/**
@notice Get the Survey title
@dev Body is the ADDRESS of the survey contract. You NEED to know the survey contract address.
@dev otherwise, just use /getAllSurveys. This method should NEVER be used except for debugging
**/
server.post('/getSurveyTitle', async (req, res) => {
  try {
    const survey = req.body;
    const surveyAddress = survey.address.toString();
    const trackerContract = await getTracker(
      interface,
      bytecode,
      TrackerAddresses.last(),
    );
    trackerContract.methods
      .getSurveyTitleByAddress(surveyAddress)
      .call({})
      .then(result => {
        res.send(result);
        res.end();
      });
  } catch (ex) {
    res.status(400).send(ex.toString());
    console.log(ex.toString());
  }
});

/**
@notice Get list of surveys titles + address
@dev Get the list of surveys with title so that you can populate the front end
@dev returns an array
**/
server.get('/getAllSurveys', async (req, res) => {
  try {
    const promiseArray = [];
    const trackerContract = await getTracker(
      interface,
      bytecode,
      TrackerAddresses.last(),
    );
    const ids = await trackerContract.methods.getSurveyIds().call({});
    ids.forEach(item => {
      promiseArray.push(
        trackerContract.methods.getSurveyTitleById(item).call({}),
      );
    });
    Promise.all(promiseArray).then(result => {
      const output = result.map(x => {
        x[2] = web3.utils.hexToNumber(x[2]['_hex']);

        return x;
      });

      res.send(output);
    });
  } catch (ex) {
    res.status(500).send(ex.toString());
    console.log(ex.toString());
  }
});

/**
@notice Get all questions and their options with values values
@dev
**/
server.post('/getQuestions', async (req, res) => {
  try {
    const surveyAddress = req.body.surveyAddress;
    const trackerContract = await getTracker(
      interface,
      bytecode,
      TrackerAddresses.last(),
    );
    const surveyTitle = await trackerContract.methods
      .getSurveyTitleByAddress(surveyAddress)
      .call({});
    const finalOutput = {
      title: '',
      questions: [],
    };
    trackerContract.methods
      .getSurveyQuestionArray(surveyAddress)
      .call({})
      .then(result => {
        const promiseArray = [];
        result.forEach(item => {
          promiseArray.push(
            trackerContract.methods.getOptions(surveyAddress, item).call({}),
          );
        });
        Promise.all(promiseArray).then(result => {
          const output = result.map(x => {
            const text = web3.utils.hexToUtf8(x['0']);
            const options = bytes32toString(x['1']);
            return {
              text,
              options,
            };
          });
          finalOutput.title = surveyTitle;
          finalOutput.questions = output;
          res.send(finalOutput);
        });
      });
  } catch (ex) {
    res.status(500).send(ex.toString());
    console.log(ex);
  }
});

/**
@notice Get all questions and their options with values values
@dev
**/
server.post('/getAnswers', async (req, res) => {
  try {
    const surveyAddress = req.body.surveyAddress;
    const trackerContract = await getTracker(
      interface,
      bytecode,
      TrackerAddresses.last(),
    );
    const surveyTitle = await trackerContract.methods
      .getSurveyTitleByAddress(surveyAddress)
      .call({});
    const finalOutput = {
      title: '',
      questions: [],
    };
    trackerContract.methods
      .getSurveyQuestionArray(surveyAddress)
      .call({})
      .then(result => {
        const promiseArray = [];
        result.forEach(item => {
          promiseArray.push(
            trackerContract.methods.getOptions(surveyAddress, item).call({}),
          );
        });
        Promise.all(promiseArray).then(result => {
          const output = result.map(x => {
            const text = web3.utils.hexToUtf8(x['0']);
            const options = bytes32toString(x['1']);
            const values = hexToNumber(x['2']);
            return {
              text,
              options,
              values,
            };
          });
          finalOutput.title = surveyTitle;
          finalOutput.questions = output;
          res.send(finalOutput);
        });
      });
  } catch (ex) {
    res.status(500).send(ex.toString());
    console.log(ex);
  }
});

/**
@notice answer the questions
@dev Include the question and selected text in the body
**/

server.post('/answerQuestion', async (req, res) => {
  try {
    const surveyAddress = req.body.address;
    const surveyAnswers = req.body.answers;
    const trackerContract = await getTracker(
      interface,
      bytecode,
      TrackerAddresses.last(),
    );
    const account = await getAddress();
    const promiseArray = [];
    surveyAnswers.forEach(item => {
      questionArray = [item.text, item.option];
      promiseArray.push(stringToBytes32(questionArray));
    });
    Promise.all(promiseArray).then(result => {
      const promiseArray2 = [];
      result.forEach(item => {
        promiseArray2.push(
          trackerContract.methods
            .answerQuestion(surveyAddress, item[0], item[1])
            .send({
              from: account,
              gas: 470000000,
            }),
        );
      });
      //updates the participant count
      promiseArray2.push(
        trackerContract.methods.updateParticipants(surveyAddress).send({
          from: account,
          gas: 470000000,
        }),
      );
      Promise.all(promiseArray2).then(result => {
        result.forEach(item => {
          if (item.transactionHash != undefined) {
            console.log(
              `Succesfully answered with txhash:${item.transactionHash}`,
            );
          }
        });
        res.send('success');
        res.end();
      });
    });
  } catch (ex) {
    res.status(500).send(ex.toString());
  }
});

/**
@notice Test function for express post
@dev
**/
server.post('/post', async (req, res) => {
  try {
    console.log('receiving request');
    res.send(req.body);
  } catch {
    res.status(400);
  }
});

/**
Cut string
**/

function splitString(string, length) {
  return string.match(new RegExp(`.{1,${length}}`, 'g'));
}

/**
@notice helper function to convert an array of stirngs to bytes32
@dev
**/

async function stringToBytes32(optionArray) {
  const tempArray = [];
  optionArray.forEach(item => {
    tempArray.push(web3.utils.fromAscii(item));
  });
  return tempArray;
}

function bytes32toString(optionArray) {
  const tempArray = [];
  optionArray.forEach(item => {
    tempArray.push(web3.utils.hexToUtf8(item));
  });
  return tempArray;
}

function hexToNumber(optionArray) {
  const tempArray = [];
  optionArray.forEach(item => {
    tempArray.push(web3.utils.hexToNumber(item['_hex']));
  });
  return tempArray;
}

/**
@notice Helper function to get last Array
@dev
**/
if (!Array.prototype.last) {
  Array.prototype.last = function() {
    return this[this.length - 1];
  };
}

server.listen(3333);
console.log('listening on: ' + '127.0.0.1:3333');
