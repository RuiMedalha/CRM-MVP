import { n, eur } from './utils';
import type { PublicQuotationItem } from '@/types/quotation';

/** Parse comparison_specs that may come as null, JSON string, or array */
const parseSpecs = (v: any): Array<{ label: string; value: string }> => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Safe group name coercion */
const safeGroup = (v: any): string => String(v ?? '');

/** Safe is_recommended coercion (can be boolean, string "true", or 1) */
const isRec = (v: any): boolean => v === true || v === 'true' || v === 1;

interface ComparisonGroup {
  group: string;
  items: PublicQuotationItem[];
}

interface ComparisonSectionProps {
  groups: ComparisonGroup[];
  quotation: { comparison_recommendation_text?: string | null };
}

function RecommendedBadge() {
  return (
    <span
      style={{
        background: '#1a6b7c',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
        marginLeft: '8px',
      }}
    >
      ⭐ Recomendado
    </span>
  );
}

function DesktopTable({ group }: { group: ComparisonGroup }) {
  const allLabels: string[] = [];
  group.items.forEach((item) => {
    parseSpecs(item.comparison_specs).forEach((spec) => {
      if (!allLabels.includes(spec.label)) allLabels.push(spec.label);
    });
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}
      >
        <thead>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }} />
            {group.items.map((item) => (
              <th
                key={item.id}
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  borderBottom: '1px solid #e2e8f0',
                  borderTop: isRec(item.is_recommended) ? '2px solid #1a6b7c' : undefined,
                  background: isRec(item.is_recommended) ? '#e8f4f7' : undefined,
                  fontWeight: 600,
                  color: '#1a1a2e',
                }}
              >
                {item.product_name}
                {isRec(item.is_recommended) && <RecommendedBadge />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Price row */}
          <tr>
            <td
              style={{
                padding: '12px',
                fontWeight: 600,
                color: '#4a5568',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              Preço
            </td>
            {group.items.map((item) => (
              <td
                key={item.id}
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: '#1a6b7c',
                  borderBottom: '1px solid #e2e8f0',
                  background: isRec(item.is_recommended) ? '#e8f4f7' : undefined,
                }}
              >
                {eur(item.unit_price)}
              </td>
            ))}
          </tr>
          {/* Spec rows */}
          {allLabels.map((label) => (
            <tr key={label}>
              <td
                style={{
                  padding: '12px',
                  color: '#4a5568',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                {label}
              </td>
              {group.items.map((item) => {
                const spec = parseSpecs(item.comparison_specs).find((s) => s.label === label);
                return (
                  <td
                    key={item.id}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      borderBottom: '1px solid #e2e8f0',
                      background: isRec(item.is_recommended) ? '#e8f4f7' : undefined,
                    }}
                  >
                    {spec?.value || '—'}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Datasheet row */}
          <tr>
            <td style={{ padding: '12px', color: '#4a5568' }}>Ficha Técnica</td>
            {group.items.map((item) => (
              <td
                key={item.id}
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  background: isRec(item.is_recommended) ? '#e8f4f7' : undefined,
                }}
              >
                {item.datasheet_url ? (
                  <a
                    href={item.datasheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1a6b7c', textDecoration: 'underline' }}
                  >
                    {item.datasheet_label || 'Ver ficha'}
                  </a>
                ) : (
                  '—'
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({ group }: { group: ComparisonGroup }) {
  const sorted = [...group.items].sort((a, b) =>
    isRec(a.is_recommended) ? -1 : isRec(b.is_recommended) ? 1 : 0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {sorted.map((item) => (
        <div
          key={item.id}
          style={{
            border: isRec(item.is_recommended) ? '2px solid #1a6b7c' : '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontWeight: 600, color: '#1a1a2e' }}>
              {item.product_name}
            </span>
            {isRec(item.is_recommended) && <RecommendedBadge />}
          </div>
          <p
            style={{
              fontWeight: 700,
              color: '#1a6b7c',
              fontSize: '18px',
              margin: '0 0 12px 0',
            }}
          >
            {eur(item.unit_price)}
          </p>
          {parseSpecs(item.comparison_specs).length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0' }}>
              {parseSpecs(item.comparison_specs).map((spec) => (
                <li
                  key={spec.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    fontSize: '13px',
                    color: '#4a5568',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <span>{spec.label}</span>
                  <span style={{ fontWeight: 500 }}>{spec.value}</span>
                </li>
              ))}
            </ul>
          )}
          {item.datasheet_url && (
            <a
              href={item.datasheet_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1a6b7c', fontSize: '13px', textDecoration: 'underline' }}
            >
              {item.datasheet_label || 'Ver ficha técnica'}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export function ComparisonSection({ groups, quotation }: ComparisonSectionProps) {
  if (!groups.length) return null;

  return (
    <div>
      <h2 style={{ fontFamily: 'serif', fontSize: '22px', color: '#1a1a2e', margin: '0 0 4px 0' }}>
        Compare as Opções
      </h2>
      <p style={{ fontSize: '14px', color: '#718096', margin: '0 0 24px 0' }}>
        Seleccionámos as melhores alternativas para o seu caso
      </p>

      {groups.map((group) => (
        <div key={group.group} style={{ marginBottom: '32px' }}>
          {groups.length > 1 && (
            <h3 style={{ fontSize: '16px', color: '#1a1a2e', margin: '0 0 12px 0' }}>
              {group.group}
            </h3>
          )}
          {/* Desktop */}
          <div className="he-comparison-desktop">
            <DesktopTable group={group} />
          </div>
          {/* Mobile */}
          <div className="he-comparison-mobile">
            <MobileCards group={group} />
          </div>
        </div>
      ))}

      {quotation.comparison_recommendation_text && (
        <div
          style={{
            background: '#e8f4f7',
            border: '1px solid #1a6b7c',
            padding: '16px',
            borderRadius: '8px',
            marginTop: '16px',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: '14px', color: '#1a1a2e' }}>
            💡 Porque recomendamos esta opção:
          </p>
          <p
            style={{
              margin: 0,
              fontStyle: 'italic',
              fontSize: '15px',
              color: '#1a6b7c',
              lineHeight: 1.6,
            }}
          >
            {quotation.comparison_recommendation_text}
          </p>
        </div>
      )}

      <style>{`
        @media (min-width: 600px) {
          .he-comparison-desktop { display: block; }
          .he-comparison-mobile { display: none; }
        }
        @media (max-width: 599px) {
          .he-comparison-desktop { display: none; }
          .he-comparison-mobile { display: block; }
        }
      `}</style>
    </div>
  );
}
