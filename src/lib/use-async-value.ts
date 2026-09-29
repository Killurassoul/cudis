import { useEffect, useState } from "react";

export function useAsyncValue<T>(key: string, load: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (active) setValue(next);
    }).catch((error: unknown) => console.error("Public content could not be loaded", error));
    return () => { active = false; };
    // The caller provides a stable key for the request parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return value;
}
