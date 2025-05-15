"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserProfile } from "./user-profile";
import { toast } from "sonner";

export function AuthSection() {
  const { data: session, status } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [view, setView] = useState<'options' | 'emailMagic' | 'signin' | 'signup'>(
    'options'
  );
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Show skeleton while loading
  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />;
  }

  // If authenticated, show the profile menu
  if (status === "authenticated" && session?.user) {
    return <UserProfile />;
  }

  const handleEmailMagic = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) signIn('email', { email });
  };

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await signIn('credentials', { email, password, redirect: false });
    setIsDialogOpen(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error || 'Registration failed');
        return;
      }
      await signIn('credentials', { email, password, redirect: false });
      setIsDialogOpen(false);
    } catch (err) {
      toast.error('Registration error');
    }
  };

  // Otherwise show login dialog
  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(open) { setView('options'); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Log in
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md space-y-4 bg-background dark:bg-neutral-900 bg-white z-[500]" style={{top: "calc(50px + 2rem)", position: "absolute", transform: "translate(-50%, 0)"}}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Welcome</DialogTitle>
        </DialogHeader>
        {view === 'options' && (
          <>
            <Button className="w-full" variant="outline" onClick={() => setView('signup')}>
              Register
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setView('emailMagic')}>
              Sign in with Email
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setView('signin')}>
              Sign in with Password
            </Button>
            <Button className="w-full" variant="outline" onClick={() => signIn("google")}>
              Continue with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  For Developers
                </span>
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={() => signIn("linear")}>
              Developer Login with Linear
            </Button>
          </>
        )}

        {view === 'emailMagic' && (
          <form onSubmit={handleEmailMagic} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                We'll email you a login link. No password needed.
              </p>
            </div>
            <Button type="submit" className="w-full">Send magic link</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setView('options')}>
              Back
            </Button>
          </form>
        )}

        {view === 'signin' && (
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setView('options')}>
              Back
            </Button>
          </form>
        )}

        {view === 'signup' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">Register</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setView('options')}>
              Back
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 