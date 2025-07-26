// Teste de carga usando k6
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '30s', target: 20 },   // Ramp up
        { duration: '1m', target: 20 },    // Stay at 20 users
        { duration: '30s', target: 50 },   // Ramp up
        { duration: '2m', target: 50 },    // Stay at 50 users
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% das requisições < 500ms
        http_req_failed: ['rate<0.1'],    // Taxa de erro < 10%
    },
};

export default function() {
    // Teste da página inicial
    let response = http.get('https://dnxtai.com');
    check(response, {
        'status é 200': (r) => r.status === 200,
        'página carregou': (r) => r.body.includes('NXT.AI'),
        'tempo < 500ms': (r) => r.timings.duration < 500,
    });
    
    sleep(1);
    
    // Teste do formulário de contato
    let contactData = {
        name: 'Teste Usuario',
        email: 'teste@example.com',
        phone: '38999999999',
        message: 'Teste de carga'
    };
    
    response = http.post('https://api.dnxtai.com/contact', contactData);
    check(response, {
        'formulário enviado': (r) => r.status === 200 || r.status === 201,
    });
    
    sleep(2);
}
