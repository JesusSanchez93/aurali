import {
  Html, Head, Body, Container, Section, Text, Heading, Button,
} from '@react-email/components';

type OrgApprovedEmailProps = {
  companyName: string;
  loginUrl: string;
};

export function OrgApprovedEmail({ companyName, loginUrl }: OrgApprovedEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading as="h1" style={styles.headerTitle}>Aurali · Cuenta aprobada</Heading>
          </Section>

          <Section style={styles.content}>
            <Text>Hola,</Text>
            <Text>
              Tu organización <strong>{companyName}</strong> ya fue aprobada. Ya puedes
              ingresar a Aurali y empezar a operar.
            </Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={loginUrl} style={styles.button}>
                Ingresar a Aurali
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
