export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

export function createPatientDetailUrl(patientId: string, section: 'historia' | 'dieta' = 'historia', tab?: string) {
    const resolvedTab = tab || (section === 'dieta' ? 'alimentos' : 'general');
    return createPageUrl(`PatientDetail?id=${patientId}&section=${section}&tab=${resolvedTab}`);
}