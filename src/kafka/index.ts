import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BROKERS!.split(","),
});

export const producer = kafka.producer()

export const consumer = kafka.consumer({ groupId: 'messages-consumer-group' })

export async function initializeProducer() {
  await producer.connect();
}

export async function disconnectProducer() {
  await producer.disconnect();
}