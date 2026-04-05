import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Img,
  Hr,
} from '@react-email/components';

export interface EmailTheme {
  primaryColor: string;
  ctaColor: string;
  ctaTextColor: string;
  orgName: string;
  logoUrl?: string;
}

const DEFAULT_THEME: EmailTheme = {
  primaryColor: '#1E1B4B',
  ctaColor: '#F59E0B',
  ctaTextColor: '#111827',
  orgName: 'Aurali Legal',
};

interface WorkflowEmailProps {
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  subject?: string;
  theme?: Partial<EmailTheme>;
}

export function WorkflowEmail({
  bodyHtml,
  ctaUrl,
  ctaLabel,
  subject,
  theme,
}: WorkflowEmailProps) {
  const t: EmailTheme = { ...DEFAULT_THEME, ...theme };

  return (
    <Html lang="es">
      <Head />
      {subject && <Preview>{subject}</Preview>}
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Header */}
          <Section style={{ ...styles.header, backgroundColor: t.primaryColor }}>
            {t.logoUrl ? (
              <Img src={t.logoUrl} alt={t.orgName} height={32} style={styles.logo} />
            ) : (
              <Text style={styles.headerTitle}>{t.orgName}</Text>
            )}
          </Section>

          {/* Body content */}
          <Section style={styles.content}>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {/* CTA button */}
          {ctaUrl && (
            <Section style={styles.ctaSection}>
              <Button
                href={ctaUrl}
                style={{
                  ...styles.button,
                  backgroundColor: t.ctaColor,
                  color: t.ctaTextColor,
                }}
              >
                {ctaLabel ?? 'Completar formulario →'}
              </Button>
            </Section>
          )}

          {/* Footer */}
          <Section style={styles.footer}>
            <Hr style={styles.divider} />
            <Text style={styles.footerText}>
              Este mensaje fue generado automáticamente por {t.orgName}.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#F3F4F6',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 0,
    margin: 0,
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    padding: '24px',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: '700',
    margin: 0,
  },
  logo: {
    display: 'block',
  },
  content: {
    padding: '32px',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#111827',
  },
  ctaSection: {
    textAlign: 'center' as const,
    padding: '0 32px 32px',
  },
  button: {
    fontWeight: '700',
    padding: '14px 28px',
    borderRadius: '8px',
    fontSize: '16px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  footer: {
    padding: '0 32px 24px',
  },
  divider: {
    borderTop: '1px solid #E5E7EB',
    margin: '0 0 16px',
  },
  footerText: {
    textAlign: 'center' as const,
    color: '#9CA3AF',
    fontSize: '12px',
    margin: 0,
  },
};
