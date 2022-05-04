const functions = require("firebase-functions");
const {PubSub} = require("@google-cloud/pubsub");

/**
 * Publishes a message, creating the topic if it doesn't exist.
 * @param {string} topic Topic of the message
 * @param {object} messageData Data of the message
 */
exports.messageWithCreate = async function(topic, messageData = {}) {
  await messageWithCreateInternal(topic, messageData);
};

/**
 * Publishes a message, creating the topic if it doesn't exist.
 * @param {string} topic Topic of the message
 * @param {object} messageData Data of the message
 * @param {boolean} createIfNotExists Should create the topic if it doesnt exist. Used to control recursion
 */
async function messageWithCreateInternal(topic, messageData = {}, createIfNotExists = true) {
  const pubsub = new PubSub({projectId: process.env.PROJECT});
  try {
    await pubsub.topic(topic).publishMessage({
      json: messageData,
    });
  } catch (e) {
    if (!createIfNotExists || !e.message.includes("NOT_FOUND: Topic not found")) {
      throw e;
    }
    try {
      await pubsub.createTopic(topic);
      functions.logger.info(`Created topic ${topic}`);
    } catch (e) {
      // If we call this method multiple times in quick succession, we may try to create it multiple times
      // Just ignore that error
      if (!e.message.includes("ALREADY_EXISTS: Topic already exists")) {
        functions.logger.warn(`Failed to create topic ${topic}, it already exists`);
        throw e;
      }
    }
    await messageWithCreateInternal(topic, messageData, false);
  }
  functions.logger.debug(`Message emitted to ${topic}`);
}
