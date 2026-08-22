import Link from "next/link";

export default function PaymentConfirmedPage() {
  return <main className="payment-confirmation"><section><img src="/proyecto-90-logo-transparente.png" alt="Proyecto 90"/><span className="landing-kicker"><i/> PAGO RECIBIDO</span><h1>Tu primer paso ya está listo.</h1><p>Estamos validando tu matrícula. Revisa el correo que utilizaste al pagar: ahí recibirás la confirmación y el enlace para entrar a Proyecto 90.</p><div className="payment-mail-note"><b>¿Qué pasa después?</b><span>Abres el enlace del correo, ingresas con tus datos, completas el formulario inicial y accedes a tu plataforma.</span></div><Link className="landing-secondary" href="/">Volver al inicio</Link></section></main>;
}
