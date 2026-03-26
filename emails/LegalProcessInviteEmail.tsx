import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Button,
} from '@react-email/components';

type LegalProcessInviteEmailProps = {
  link: string;
  lawyerName?: string;
  year?: number;
};

export function LegalProcessInviteEmail({
  link,
  lawyerName = 'Moratto Abogados',
  year = new Date().getFullYear(),
}: LegalProcessInviteEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          
          {/* Header */}
          <Section style={styles.header}>
            <Heading as="h1" style={styles.headerTitle}>
              Aurali · Proceso Legal
            </Heading>
          </Section>

          {/* Content */}
          <Section style={styles.content}>
            <Text>Hola,</Text>

            <Text>
              Tu abogado/a <strong>{lawyerName}</strong> ha iniciado un proceso legal
              para ti. Para continuar, necesitamos que completes tu información
              personal y algunos datos relevantes del caso.
            </Text>

            <Section style={styles.highlightBox}>
              <Text style={styles.highlightTitle}>
                🔐 Acceso seguro y de un solo uso
              </Text>
              <Text>
                Este enlace es personal y solo puede utilizarse una vez por motivos
                de seguridad.
              </Text>
            </Section>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button href={link} style={styles.button}>
                Completar información del proceso
              </Button>
            </Section>

            <Text style={{ fontWeight: 600 }}>⏳ Importante</Text>
            <ul>
              <li>El enlace dejará de funcionar una vez que envíes la información.</li>
              <li>
                Si el enlace expira, deberás contactar a tu abogado/a para generar uno nuevo.
              </li>
            </ul>

            <Text>
              Toda la información será tratada de forma confidencial y utilizada
              únicamente para la gestión de tu proceso legal.
            </Text>

            <Text style={{ marginTop: 32 }}>
              Saludos,<br />
              <strong>Equipo Aurali</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text>© {year} Aurali. Todos los derechos reservados.</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#f4f6f8',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: 0,
    margin: 0,
  },
  container: {
    maxWidth: '600px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#0f172a',
    padding: '24px',
  },
  headerTitle: {
    color: '#ffffff',
    margin: 0,
    fontSize: '20px',
  },
  content: {
    padding: '32px',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#111827',
  },
  highlightBox: {
    backgroundColor: '#f1f5f9',
    borderLeft: '4px solid #2563eb',
    padding: '16px',
    margin: '24px 0',
  },
  highlightTitle: {
    fontWeight: 600,
    marginBottom: '8px',
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '14px 24px',
    borderRadius: '6px',
    fontWeight: 600,
    textDecoration: 'none',
  },
  footer: {
    backgroundColor: '#f8fafc',
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center' as const,
    padding: '16px',
  },
};
