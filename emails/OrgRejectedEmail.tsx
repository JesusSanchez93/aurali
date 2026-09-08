import {
  Html, Head, Body, Container, Section, Text, Heading,
} from '@react-email/components';

type OrgRejectedEmailProps = {
  companyName: string;
};

export function OrgRejectedEmail({ companyName }: OrgRejectedEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading as="h1" style={styles.headerTitle}>Aurali · Estado de tu solicitud</Heading>
          </Section>

          <Section style={styles.content}>
            <Text>Hola,</Text>
            <Text>
              Gracias por tu interés en Aurali y por registrar a <strong>{companyName}</strong>.
              Luego de revisar tu solicitud, por el momento no podemos aprobarla.
            </Text>
            <Text>
              Esto no significa una respuesta definitiva: tu solicitud queda guardada y, si
              más adelante las condiciones cambian, con gusto la revisaremos nuevamente y
              podremos activarla.
            </Text>
            <Text>
              Si tienes alguna pregunta o quieres conversar sobre tu caso, no dudes en
              responder a este correo. Será un gusto ayudarte.
            </Text>

            <Text style={{ marginTop: 32 }}>
              Saludos cordiales,<br />
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
  footer: { backgroundColor: '#f8fafc', fontSize: '12px', color: '#6b7280', textAlign: 'center' as const, padding: '16px' },
};
