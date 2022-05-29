/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
// const jwt = require('jsonwebtoken');
const { unlink } = require('fs');
const uuid = require('uuid');
const axios = require('axios');
const cheerio = require('cheerio');

const ApiError = require('../error/ApiError');
const cloudinary = require('../../utils/cloudinary');
const { ExampleSentences, Word } = require('../models');

async function pushPicture(picture, userId) {
  const name = uuid.v4();
  const path = `${__dirname}/../../public/${name}`;

  picture.mv(path);
  const uploadResult = await cloudinary.uploader.upload(
    path,
    { public_id: `dictionaries/user_${userId}/${name}` },
    (error, result) => {
      console.log(result, error);
    }
  );
  console.log(uploadResult);

  unlink(path, (err) => {
    console.log(err);
  });

  return uploadResult.secure_url;
}

class WordController {
  async get({ params: { id } }, res) {
    try {
      const words = await Word.findOne({ where: { id } });
      return res.status(200).send(words);
    } catch (err) {
      return res.status(400).send(err);
    }
  }

  async getAll(req, res) {
    try {
      const userId = req.user.id;
      const words = await Word.findAll({ where: { userId } });
      return res.status(200).send(words);
    } catch (err) {
      return res.status(400).send(err);
    }
  }

  async create(req, res, next) {
    // try {
    //   const userId = req.user.id;
    //   const { body } = req;
    //   const words = [];
    //   for (let i = 0; true; i++) {
    //     const firstLang = body[`firstLang${i}`];
    //     const secondLang = body[`secondLang${i}`];
    //     const example = body[`example${i}`];
    //     const translateExample = body[`translateExample${i}`];
    //     if (!firstLang || !secondLang || !example || !translateExample) {
    //       break;
    //     }

    //     let pictureURL = null;
    //     if (req.files && req.files[`picture${i}`])
    //       pictureURL = await pushPicture(req.files[`picture${i}`], userId);

    //     const word = await Word.create({
    //       firstLang,
    //       secondLang,
    //       example,
    //       translateExample,
    //       picture: pictureURL,
    //       userId,
    //     });
    //     words.push(word);
    //   }

    //   return res.status(200).send(words);
    // } catch (e) {
    //   return next(ApiError.badRequest(e.message));
    // }
    return res.status(200).send('GOOD');
  }

  async update(req, res, next) {
    try {
      const { body } = req;
      for (let i = 0; true; i++) {
        const id = body[`id${i}`];
        const firstLang = body[`firstLang${i}`];
        const secondLang = body[`secondLang${i}`];
        const example = body[`example${i}`];
        const translateExample = body[`translateExample${i}`];
        console.log(body);
        if (!firstLang || !secondLang || !example || !translateExample) {
          break;
        }

        const word = await Word.findOne({ where: { id } });
        console.log(word);
        let pictureURL = word.picture;
        console.log('hi1');
        if (req.files && req.files[`picture${i}`]) {
          if (word.picture) {
            console.log('hi2');
            const link = word.picture;
            const path = link.substring(
              link.indexOf('dictionaries'),
              link.lastIndexOf('.')
            );
            console.log('hi3');
            cloudinary.uploader.destroy(path, (result) => {
              console.log(result);
            });
          }
          console.log('hi4');
          pictureURL = await pushPicture(req.files[`picture${i}`], userId);
        }

        // const result = await Word.create(body);
        // console.log(result);
        // const lastRepetition = word.lastRepetition;
        // const timeZone = body.timeZone;
        // const str = lastRepetition.toLocaleString('en-US', {
        //   timeZone: timeZone,
        // });
        // console.log(str.split('/')[1]);
        console.log('hi5');
        await Word.update(
          {
            firstLang,
            secondLang,
            example,
            translateExample,
          },
          { where: { id } }
        ).then((result) => {
          console.log(result);
        });
      }

      return res.status(200).send('goood');
    } catch (err) {
      return res.status(400).send(err);
    }
  }

  async updateRepetedWords(req, res, next) {
    try {
      const { words } = req.body;
      const updatedWords = [];
      for (let word in words) {
        await Word.update(words[word], { where: { id: words[word].id } }).then(
          (result) => {
            updatedWords.push(result);
            console.log(result);
          }
        );
      }
      return res.status(200).send(updatedWords);
    } catch (e) {
      return next(ApiError.badRequest(e.message));
    }
  }

  async delete(req, res) {
    try {
      const wordId = req.params.id;
      const word = await Word.findOne({ where: { id: wordId } });

      if (word.picture) {
        const link = word.picture;
        const path = link.substring(
          link.indexOf('dictionaries'),
          link.lastIndexOf('.')
        );
        cloudinary.uploader.destroy(path, (result) => {
          console.log(result);
        });
      }

      const result = await Word.destroy({ where: { id: wordId } });
      return res
        .status(200)
        .send({ status: 'OK', message: `Слово удалено ${result}` });
    } catch (err) {
      return res.status(400).send(err);
    }
  }

  async getExamples(req, res, next) {
    const getHTML = async (url) => {
      const { data } = await axios.get(url);
      return cheerio.load(data);
    };

    const { word } = req.params;
    const selector = await getHTML(`https://wooordhunt.ru/word/${word}`);
    const translate = selector('#content_in_russian .t_inline_en').text();

    const englishExamples = [];
    selector('#content_in_russian .ex_o').each((i, elem) => {
      englishExamples.push(selector(elem).text());
    });

    const russianExamples = [];
    selector('#content_in_russian .ex_t').each((i, elem) => {
      russianExamples.push(selector(elem).text());
    });

    if (englishExamples.length !== 0 || russianExamples.length !== 0) {
      const checkSentencesPromise = ExampleSentences.findOne({
        where: { term: word },
      });
      checkSentencesPromise.then((examples) => {
        if (!examples) {
          const size =
            englishExamples.length < russianExamples.length
              ? englishExamples.length
              : russianExamples.length;

          for (let i = 0; i < size; i++) {
            ExampleSentences.create({
              term: word,
              example: englishExamples[i],
              translateExample: russianExamples[i],
            }).catch((err) => {
              console.log(err);
            });
          }
        }
      });
    }

    return res
      .status(200)
      .send({ translate, englishExamples, russianExamples });
  }

  async getWordsToRepeat(req, res) {
    try {
      const userId = req.user.id;
      const words = await Word.findAll({ where: { userId } });

      const { timeZone } = req.body;
      const currentDateStr = new Date().toLocaleString('en-US', { timeZone });
      const currentDate = new Date(currentDateStr);
      const repeatWords = [];
      for (let word in words) {
        let numberRepetition = words[word].numberRepetition;
        let nextRepetition = null;
        const lastRepetitionStr = new Date(
          words[word].lastRepetition
        ).toLocaleString('en-US', { timeZone });
        let lastRepetition = new Date(lastRepetitionStr); //.setHours(0, 0, 0, 0); TODO раскоментировать когда перейду на getDate

        //в будущем поменять на getDate
        if (numberRepetition === 0) {
          nextRepetition = lastRepetition;
        } else if (numberRepetition < 7)
          nextRepetition = lastRepetition.setMinutes(
            lastRepetition.getMinutes() + 1
          );
        else if (numberRepetition === 7)
          nextRepetition = lastRepetition.setMinutes(
            lastRepetition.getMinutes() + 7
          );
        else if (numberRepetition === 8)
          nextRepetition = lastRepetition.setMinutes(
            lastRepetition.getMinutes() + 14
          );
        else continue;

        if (nextRepetition < currentDate) repeatWords.push(words[word]);
      }

      return res.status(200).send(repeatWords);
    } catch (err) {
      return res.status(400).send(err);
    }
  }
}

module.exports = new WordController();
