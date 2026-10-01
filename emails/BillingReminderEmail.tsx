import {
  Html, Head, Body, Container, Section, Text, Heading, Button,
} from '@react-email/components';

type BillingReminderEmailProps = {
  companyName: string;
  planName: string;
  dueToday: boolean;
  periodEndLabel: string;
  billingUrl: string;
};

export function BillingReminderEmail({ companyName, planName, dueToday, periodEndLabel, billingUrl }: BillingReminderEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading as="h1" style={styles.headerTitle}>
              {dueToday ? 'Tu suscripción vence hoy' : 'Tu suscripción está por vencer'}
            </Heading>
          </Section>

          <Section style={styles.content}>
            <Text>Hola,</Text>
            <Text>
              La suscripción al plan <strong>{planName}</strong> de <strong>{companyName}</strong>{' '}
              {dueToday ? (
                <>vence hoy, <strong>{periodEndLabel}</strong>.</>
              ) : (
                <>vence el <strong>{periodEndLabel}</strong>.</>
              )}
            </Text>
            <Text>
              Regulariza el pago para evitar interrupciones en la creación de procesos y generación
              de documentos — encuentra los datos de transferencia y el historial de pagos en tu
              página de Plan y facturación.
            </Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={billingUrl} style={styles.button}>
                Ver plan y facturación
              </Button>
            </Section>

            <Text style={{ marginTop: 32 }}>
              Saludos,<br />
              <strong>Equipo Aurali</strong>
            </Text>
          </Section>

          <Section style={styles.footer}>
            <Text>© {new Date().getFullYear()} Aurali. Todos los derechos reservados.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: '#f4f6f8', fontFamily: 'Arial, Helvetica, sans-serif', padding: 0, margin: 0 },
  container: { maxWidth: '600px', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' },
  header: { backgroundColor: '#0f172a', padding: '24px' },
  headerTitle: { color: '#ffffff', margin: 0, fontSize: '20px' },
  content: { padding: '32px', fontSize: '14px', lineHeight: '1.6', color: '#111827' },
  button: { backgroundColor: '#2563eb', color: '#ffffff', padding: '14px 24px', borderRadius: '6px', fontWeight: 600, textDecoration: 'none' },
  footer: { backgroundColor: '#f8fafc', fontSize: '12px', color: '#6b7280', textAlign: 'center' as const, padding: '16px' },
};
