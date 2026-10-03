import {
  Html, Head, Body, Container, Section, Text, Heading, Button,
} from '@react-email/components';

type SupportAccessRequestEmailProps = {
  organizationName: string;
  staffName: string;
  takeControl?: boolean;
  reviewUrl: string;
};

export function SupportAccessRequestEmail({ organizationName, staffName, takeControl = false, reviewUrl }: SupportAccessRequestEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading as="h1" style={styles.headerTitle}>Aurali · Solicitud de acceso</Heading>
          </Section>

          <Section style={styles.content}>
            <Text>Hola,</Text>
            <Text>
              <strong>{staffName}</strong>, del equipo de Aurali, quiere ingresar a la cuenta de{' '}
              <strong>{organizationName}</strong>
              {takeControl ? ' y tomar el control.' : '.'}
            </Text>
            {takeControl && (
              <Text>
                Si lo apruebas, verás en vivo dentro de la plataforma cada página que abra y cada acción que
                realice mientras esté en tu cuenta.
              </Text>
            )}
            <Text>
              Nadie del equipo de Aurali entra a tu cuenta sin tu aprobación. Puedes aprobar o rechazar la
              solicitud desde la plataforma, y revocar el acceso en cualquier momento.
            </Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={reviewUrl} style={styles.button}>
                Revisar solicitud
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
