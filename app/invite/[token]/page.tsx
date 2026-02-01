"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Users } from "lucide-react";

interface InviteData {
  email: string;
  name: string | null;
  role: string;
  tenant: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await fetch(`/api/team/invites/accept?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Convite inválido");
          return;
        }

        setInvite(data);
        setName(data.name || "");
      } catch {
        setError("Erro ao carregar convite");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInvite();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/team/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          name: name.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao aceitar convite");
        return;
      }

      setSuccess(true);
      toast.success("Conta criada com sucesso!");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      toast.error("Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleName = (role: string) => {
    const roles: Record<string, string> = {
      owner: "Proprietário",
      admin: "Administrador",
      manager: "Gerente",
      agent: "Agente",
      viewer: "Visualizador",
    };
    return roles[role] || role;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando convite...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Convite Inválido</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Link href="/login">
                <Button variant="outline">Ir para Login</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle>Conta Criada!</CardTitle>
              <CardDescription>
                Sua conta foi criada com sucesso. Redirecionando para o login...
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Invite form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-2xl font-bold text-white">ScaleForce</span>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              Você foi convidado!
            </CardTitle>
            <CardDescription className="text-center">
              <span className="font-medium text-white">{invite?.tenant?.name}</span> convidou
              você para fazer parte da equipe como{" "}
              <span className="font-medium text-primary">
                {getRoleName(invite?.role || "agent")}
              </span>
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invite?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Criar senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aceitar Convite e Criar Conta
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Já tem uma conta?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Fazer login
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
