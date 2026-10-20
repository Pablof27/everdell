import type { GetServerSideProps } from "next";
import Head from "next/head";
import styles from "../../styles/Home.module.css";
import GameBuilder from "../../components/GameBuilder";
import { BotOptions, getBotOptions } from "../../bot/botCatalog";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: { botOptions: getBotOptions() },
});

export default function NewGamePage({
  botOptions,
}: {
  botOptions: BotOptions;
}) {
  return (
    <div className={styles.container}>
      <Head>
        <title>Everdell New Game</title>
      </Head>
      <GameBuilder botOptions={botOptions} />
    </div>
  );
}
