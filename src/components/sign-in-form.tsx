"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Waves } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Divider } from "@astryxdesign/core/Divider";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";

/** The front door, in the shape of Astryx's login page: one card, centred
 *  on the page ground.
 *
 *  `devAdminName` arrives already decided by the server: the page only passes
 *  a name when the deployment is allowed a passwordless sign-in, so the client
 *  never carries the rule and cannot be talked into showing the button. */
export function SignInForm({ devAdminName }: { devAdminName: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function land() {
    setError(null);
    // `/start` reads the role and lands them where their day begins.
    router.push("/start");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      // One failure sentence for every reason. Saying which half was wrong
      // turns the form into a way of finding out who has an account.
      const wrong = "That email and password don't match an active account.";
      try {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (!result || result.error) {
          setError(wrong);
          return;
        }
      } catch {
        setError("Something went wrong signing in. Try again.");
        return;
      }
      land();
    });
  }

  function handleDevSignIn() {
    startTransition(async () => {
      try {
        const result = await signIn("dev-admin", { redirect: false });
        if (!result || result.error) {
          setError("The dev sign-in is not available on this deployment.");
          return;
        }
      } catch {
        setError("The dev sign-in is not available on this deployment.");
        return;
      }
      land();
    });
  }

  return (
    <Center axis="both" minHeight="100svh" padding={4}>
      <Card width="100%" maxWidth={400} padding={6}>
        <VStack gap={5}>
          <VStack gap={1}>
            <HStack gap={1} vAlign="center">
              <Icon icon={Waves} size="sm" />
              <Text weight="semibold">Swimly</Text>
            </HStack>
            <Heading level={1}>Sign in</Heading>
          </VStack>

          <form onSubmit={handleSubmit}>
            <FormLayout defaultOptionality="required">
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                htmlName="email"
                size="lg"
              />
              <TextInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                htmlName="password"
                size="lg"
              />

              {error ? <Banner status="error" title={error} collapsible={false} /> : null}

              <Button
                type="submit"
                label={pending ? "Signing in…" : "Sign in"}
                variant="primary"
                size="lg"
                width="100%"
                isLoading={pending}
              />
            </FormLayout>
          </form>

          {devAdminName ? (
            <>
              <Divider />
              <VStack gap={2}>
                <Banner
                  status="warning"
                  title="Dev deployment"
                  description="This button does not exist in production."
                  collapsible={false}
                />
                <Button
                  type="button"
                  label={`Sign in as ${devAdminName}`}
                  variant="secondary"
                  size="lg"
                  width="100%"
                  isDisabled={pending}
                  onClick={handleDevSignIn}
                />
              </VStack>
            </>
          ) : null}
        </VStack>
      </Card>
    </Center>
  );
}
