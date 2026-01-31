"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Kanban,
  Megaphone,
  Flame,
  Zap,
  Wallet,
  UsersRound,
  Link2,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Star,
  Shield,
  Clock,
  TrendingUp,
  MessageCircle,
  Bot,
  ChevronRight,
  Play,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Dashboard Inteligente",
    description:
      "Visualize todas as metricas do seu negocio em tempo real. Leads, conversas, campanhas e saldo em um unico lugar.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Users,
    title: "CRM Completo",
    description:
      "Gerencie seus leads com campos personalizados, tags, status e historico completo de interacoes.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: MessageSquare,
    title: "Inbox Multi-Instancia",
    description:
      "Conecte multiplos numeros WhatsApp e gerencie todas as conversas em uma unica interface unificada.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Kanban,
    title: "Kanban Visual",
    description:
      "Visualize seu pipeline de vendas com quadros Kanban personalizaveis. Arraste e solte para atualizar status.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: Megaphone,
    title: "Campanhas em Massa",
    description:
      "Envie mensagens personalizadas para milhares de contatos. Agende, segmente e acompanhe resultados.",
    color: "from-red-500 to-rose-500",
  },
  {
    icon: Flame,
    title: "Aquecimento de Chips",
    description:
      "Mantenha seus numeros ativos e evite bloqueios com aquecimento automatico entre instancias.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Zap,
    title: "Automacoes Poderosas",
    description:
      "Crie fluxos automaticos baseados em eventos. Webhooks, agendamentos e triggers personalizados.",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: UsersRound,
    title: "Gestao de Equipe",
    description:
      "Adicione membros da equipe com diferentes niveis de acesso. Departamentos e permissoes granulares.",
    color: "from-indigo-500 to-purple-500",
  },
  {
    icon: Link2,
    title: "Integracoes",
    description:
      "Conecte com suas ferramentas favoritas. Webhooks, APIs e integracoes nativas disponiveis.",
    color: "from-teal-500 to-cyan-500",
  },
];

const benefits = [
  {
    icon: TrendingUp,
    title: "Aumente suas vendas",
    description: "Converta mais leads com atendimento rapido e personalizado",
  },
  {
    icon: Clock,
    title: "Economize tempo",
    description: "Automatize tarefas repetitivas e foque no que importa",
  },
  {
    icon: Shield,
    title: "Proteja seus numeros",
    description: "Aquecimento inteligente evita bloqueios do WhatsApp",
  },
  {
    icon: Bot,
    title: "Escale seu atendimento",
    description: "Gerencie milhares de conversas com uma equipe enxuta",
  },
];

const plans = [
  {
    name: "Starter",
    price: "97",
    description: "Para quem esta comecando",
    features: [
      "1 instancia WhatsApp",
      "500 leads",
      "1.000 mensagens/mes",
      "1 usuario",
      "Dashboard basico",
      "Suporte por email",
    ],
    popular: false,
  },
  {
    name: "Pro",
    price: "197",
    description: "Para negocios em crescimento",
    features: [
      "3 instancias WhatsApp",
      "5.000 leads",
      "10.000 mensagens/mes",
      "5 usuarios",
      "Automacoes ilimitadas",
      "Aquecimento de chips",
      "Campanhas em massa",
      "Suporte prioritario",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "497",
    description: "Para operacoes de grande escala",
    features: [
      "10 instancias WhatsApp",
      "Leads ilimitados",
      "Mensagens ilimitadas",
      "Usuarios ilimitados",
      "API completa",
      "Integracao customizada",
      "Gerente de conta dedicado",
      "SLA garantido",
    ],
    popular: false,
  },
];

const testimonials = [
  {
    name: "Carlos Silva",
    role: "CEO, TechVendas",
    content:
      "O ScaleForce transformou nosso atendimento. Aumentamos as vendas em 40% no primeiro mes.",
    avatar: "CS",
  },
  {
    name: "Ana Rodrigues",
    role: "Gerente Comercial, Imob+",
    content:
      "Finalmente conseguimos gerenciar todos os nossos numeros WhatsApp em um unico lugar. Produtividade nas alturas!",
    avatar: "AR",
  },
  {
    name: "Pedro Santos",
    role: "Fundador, EduTech",
    content:
      "O aquecimento de chips salvou nossos numeros. Antes perdiamos 2-3 chips por semana, agora zero bloqueios.",
    avatar: "PS",
  },
];

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="text-lg font-bold text-white">ScaleForce</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-white transition-colors"
              >
                Funcionalidades
              </a>
              <a
                href="#pricing"
                className="text-sm text-muted-foreground hover:text-white transition-colors"
              >
                Precos
              </a>
              <a
                href="#testimonials"
                className="text-sm text-muted-foreground hover:text-white transition-colors"
              >
                Depoimentos
              </a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">
                  Comecar Gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-white" />
              ) : (
                <Menu className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface border-t border-border">
            <div className="px-4 py-4 space-y-4">
              <a
                href="#features"
                className="block text-sm text-muted-foreground hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Funcionalidades
              </a>
              <a
                href="#pricing"
                className="block text-sm text-muted-foreground hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Precos
              </a>
              <a
                href="#testimonials"
                className="block text-sm text-muted-foreground hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Depoimentos
              </a>
              <div className="pt-4 flex flex-col gap-2">
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Entrar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full">Comecar Gratis</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">
                Plataforma #1 de WhatsApp Marketing
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Venda mais pelo{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">
                WhatsApp
              </span>{" "}
              com automacao inteligente
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              CRM completo, multiplas instancias WhatsApp, campanhas em massa,
              aquecimento de chips e automacoes poderosas. Tudo em uma unica
              plataforma.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8">
                  Comecar Teste Gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-lg px-8"
              >
                <Play className="mr-2 h-5 w-5" />
                Ver Demonstracao
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Sem cartao de credito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>14 dias gratis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Cancele quando quiser</span>
              </div>
            </div>
          </div>

          {/* Hero Image/Dashboard Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border border-border bg-surface-elevated overflow-hidden shadow-2xl">
              {/* Mock Dashboard Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center text-xs text-muted-foreground">
                  app.scaleforce.com.br
                </div>
              </div>
              {/* Mock Dashboard Content */}
              <div className="p-6 bg-gradient-to-br from-surface to-surface-elevated">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Leads", value: "12.458", color: "text-blue-500" },
                    { label: "Conversas", value: "847", color: "text-green-500" },
                    { label: "Campanhas", value: "23", color: "text-purple-500" },
                    { label: "Saldo", value: "R$ 2.450", color: "text-orange-500" },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg bg-surface border border-border"
                    >
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className={`text-2xl font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 h-48 rounded-lg bg-surface border border-border p-4">
                    <div className="text-sm font-medium text-white mb-4">
                      Conversas Recentes
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-500" />
                          <div className="flex-1">
                            <div className="h-3 w-32 bg-border rounded" />
                            <div className="h-2 w-48 bg-border/50 rounded mt-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-48 rounded-lg bg-surface border border-border p-4">
                    <div className="text-sm font-medium text-white mb-4">
                      Performance
                    </div>
                    <div className="flex items-end justify-around h-32 gap-2">
                      {[60, 80, 45, 90, 70, 85, 95].map((h, i) => (
                        <div
                          key={i}
                          className="w-4 bg-gradient-to-t from-primary to-orange-500 rounded-t"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Tudo que voce precisa para{" "}
              <span className="text-primary">escalar</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa com todas as ferramentas para gerenciar
              leads, automatizar atendimento e aumentar suas vendas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:border-primary/50 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Comece em <span className="text-primary">3 passos simples</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Configure sua conta e comece a vender em minutos, nao em dias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Crie sua conta",
                description:
                  "Cadastre-se gratuitamente e configure seu perfil em menos de 2 minutos.",
              },
              {
                step: "2",
                title: "Conecte o WhatsApp",
                description:
                  "Escaneie o QR Code e conecte suas instancias WhatsApp a plataforma.",
              },
              {
                step: "3",
                title: "Comece a vender",
                description:
                  "Importe seus leads, crie campanhas e comece a aumentar suas vendas.",
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-white">
                    {item.step}
                  </div>
                  {index < 2 && (
                    <ChevronRight className="hidden md:block absolute right-0 top-6 h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Planos para todos os{" "}
              <span className="text-primary">tamanhos</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comece gratis e escale conforme seu negocio cresce. Sem surpresas,
              sem taxas escondidas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`relative ${
                  plan.popular
                    ? "border-primary shadow-lg shadow-primary/20"
                    : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                      Mais Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-6 pt-8">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {plan.description}
                    </p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-2xl text-muted-foreground">R$</span>
                      <span className="text-5xl font-bold text-white">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">/mes</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/register">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      Comecar Agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="testimonials"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-surface"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              O que nossos clientes{" "}
              <span className="text-primary">dizem</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Mais de 1.000 empresas ja transformaram seu atendimento com o
              ScaleForce.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 text-yellow-500 fill-yellow-500"
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-white">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-orange-500/20 blur-3xl" />
            <div className="relative bg-surface rounded-2xl border border-border p-8 sm:p-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Pronto para escalar suas vendas?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Junte-se a mais de 1.000 empresas que ja transformaram seu
                atendimento pelo WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto text-lg px-8">
                    Comecar Teste Gratis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-lg px-8"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Falar com Vendas
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-6">
                14 dias gratis. Sem cartao de credito. Cancele quando quiser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
                </div>
                <span className="text-lg font-bold text-white">ScaleForce</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                A plataforma completa para vendas pelo WhatsApp.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-white">
                    Funcionalidades
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white">
                    Precos
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Integracoes
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-white">
                    Sobre
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Carreiras
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contato
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-white">
                    Termos de Uso
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Privacidade
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Cookies
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; 2024 ScaleForce. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-muted-foreground hover:text-white">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-white">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-white">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
