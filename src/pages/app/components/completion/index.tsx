import { useCompletion } from "@/hooks";
import { Screenshot } from "./Screenshot";
import { SystemAudioDaemonToggle } from "./SystemAudioDaemonToggle";
import { Files } from "./Files";
import { Input } from "./Input";

export const Completion = ({ isHidden }: { isHidden: boolean }) => {
  const completion = useCompletion();

  return (
    <>
      <Input {...completion} isHidden={isHidden} />
      <Screenshot {...completion} />
      <SystemAudioDaemonToggle />
      <Files {...completion} />
    </>
  );
};
