import { PropsWithChildren } from "react";
import MainLayoutHeader from "./header";
import MainLayoutFooter from "./footer";

export default function ExampleLayout({ children }: PropsWithChildren) {
  return (
    <div className="w-full min-h-screen flex flex-col justify-between">
      <MainLayoutHeader />
      <main className="h-full">{children}</main>
      <MainLayoutFooter />
    </div>
  );
}
