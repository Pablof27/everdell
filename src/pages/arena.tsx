import type { GetServerSideProps } from "next";

import Arena from "../components/Arena";
import { ArenaBotOptions, getArenaBotOptions } from "../bot/botCatalog";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: { botOptions: getArenaBotOptions() },
});

export default function ArenaPage({
  botOptions,
}: {
  botOptions: ArenaBotOptions;
}) {
  return <Arena botOptions={botOptions} />;
}
