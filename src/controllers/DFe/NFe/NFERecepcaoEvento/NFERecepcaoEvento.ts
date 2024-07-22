/*
 * This file is part of NFeWizard.
 * 
 * NFeWizard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * NFeWizard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with NFeWizard. If not, see <https://www.gnu.org/licenses/>.
 */
import { AxiosInstance } from 'axios';
import Environment from '@Classes/Environment.js';
import Utility from '@Utils/Utility.js';
import XmlBuilder from '@Classes/XmlBuilder.js';
import { EventoNFe, GenericObject, TipoEvento } from '@Protocols';
import BaseNFE from '../BaseNFe/BaseNFe.js';

class NFERecepcaoEvento extends BaseNFE {
    tpEvento: string;
    xmlEventosNacionais: string[];
    xmlEventosRegionais: string[];
    xMotivoPorEvento: any[];
    constructor(environment: Environment, utility: Utility, xmlBuilder: XmlBuilder, axios: AxiosInstance) {
        super(environment, utility, xmlBuilder, 'RecepcaoEvento', axios);
        this.tpEvento = '';
        this.xmlEventosNacionais = [];
        this.xmlEventosRegionais = [];
        this.xMotivoPorEvento = [];
    }

    protected gerarXml(data: EventoNFe): string { return '' }

    /**
     * Método para gerar o Id do evento
     */
    getID(evento: TipoEvento) {

        const { tpEvento, chNFe, nSeqEvento } = evento;

        // Validação do tipo do evento (tpEvento)
        if (typeof tpEvento !== 'string' || !/^\d{6}$/.test(tpEvento)) {
            throw new Error('tpEvento deve ser uma string com 6 dígitos.');
        }

        // Validação da chave da NF-e (chNFe)
        if (typeof chNFe !== 'string' || !/^\d{44}$/.test(chNFe)) {
            throw new Error('chNFe deve ser uma string com 44 dígitos.');
        }

        // Validação do número sequencial do evento (nSeqEvento)
        if (!Number.isInteger(nSeqEvento) || nSeqEvento < 1 || nSeqEvento > 99) {
            throw new Error('nSeqEvento deve ser um número entre 1 e 99.');
        }

        // Preenchendo o número sequencial do evento com zeros à esquerda
        const nSeqEventoPadded = nSeqEvento.toString().padStart(2, '0');

        // Construção do ID
        const id = `ID${tpEvento}${chNFe}${nSeqEventoPadded}`;

        // Verificação do comprimento do ID
        if (id.length !== 54) {
            throw new Error('O ID construído não tem 54 caracteres.');
        }

        return id; // Retorna o ID validado
    }

    /**
     * Verifica se o evento será disparado para o ambiente nacional ou para o estado pré-definido
     */
    isAmbienteNacional(tpEvento: string) {
        switch (tpEvento) {
            case '210210':
                return true;
            case '210200':
                return true;
            case '210220':
                return true;
            case '210240':
                return true;
            case '110140':
                return true;
            case '110110':
                return false;
            default:
                return false;
        }
    }

    /**
     * Retorna o nome do Evento
     */
    getTipoEventoName(tpEvento: string) {
        switch (tpEvento) {
            case '210210':
                return 'Ciência da Operação';
            case '210200':
                return 'Confirmação da Operaçã';
            case '210220':
                return 'Desconhecimento da Operação';
            case '210240':
                return 'Operação não Realizada';
            case '110110':
                return 'Carta de Correção';
            case '110111':
                return 'Cancelamento';
            case '110140':
                return 'EPEC';
            default:
                return 'Desconhecido';
        }
    }

    separaEventosPorAmbiente(evento: TipoEvento[]) {
        const nacional = evento.filter(event => ['210210', '210200', '210220', '210240', '110140'].includes(event.tpEvento));
        const regional = evento.filter(event => !['210210', '210200', '210220', '210240', '110140'].includes(event.tpEvento));

        return { nacional, regional };
    }

    /**
     * Método utilitário para criação do XML a partir de um Objeto
     */
    gerarXmlRecepcaoEvento(evento: TipoEvento[], idLote: number, ambienteNacional: boolean) {

        const { nfe: { ambiente, versaoDF }, dfe: { UF } } = this.environment.getConfig();

        for (let i = 0; i < evento.length; i++) {
            const eventoProps = evento[i];

            const {
                tpAmb,
                cOrgao,
                tpEvento,
                chNFe,
                nSeqEvento,
                CNPJ,
                CPF,
                detEvento,
                dhEvento,
                verEvento
            } = eventoProps;

            const idEvento = this.getID(eventoProps);
            // const ambienteNacional = this.isAmbienteNacional(tpEvento);
            const orgao = ambienteNacional ? 91 : cOrgao;

            this.tpEvento = tpEvento;

            //  XML parte 1
            const eventoObject = {
                $: {
                    versao: "1.00",
                    xmlns: 'http://www.portalfiscal.inf.br/nfe'
                },
                infEvento: {
                    $: {
                        Id: idEvento,
                    },
                    cOrgao: orgao,
                    tpAmb: ambiente,
                    ...(CNPJ ? { CNPJ } : { CPF }),
                    chNFe: chNFe,
                    dhEvento: dhEvento,
                    tpEvento: tpEvento,
                    nSeqEvento: nSeqEvento,
                    verEvento: verEvento,
                    detEvento: {
                        $: {
                            versao: "1.00",
                        },
                        ...detEvento,
                    },
                }
            }

            // Gera primeira parte do XML
            const eventoXML = this.xmlBuilder.gerarXml(eventoObject, 'evento')
            const xmlAssinado = this.xmlBuilder.assinarXML(eventoXML, 'infEvento');
            if (ambienteNacional) {
                this.xmlEventosNacionais.push(xmlAssinado);
            } else {
                this.xmlEventosRegionais.push(xmlAssinado);
            }
        }

        // XML parte 2
        const envEvento = {
            $: {
                versao: "1.00",
                xmlns: 'http://www.portalfiscal.inf.br/nfe'
            },
            idLote,
            _: '[XML]'
        }

        // Gera Segunda parte do XML
        const xml = this.xmlBuilder.gerarXml(envEvento, 'envEvento')
        if (ambienteNacional) {
            return xml.replace('[XML]', this.xmlEventosNacionais.join(''));
        }
        return xml.replace('[XML]', this.xmlEventosRegionais.join(''));
    }

    protected async gerarConsulta(xmlConsulta: string, ambienteNacional?: boolean) {
        try {
            // Valida Schema
            await this.utility.validateSchema(xmlConsulta, this.metodo)

            // Capturando a url do método para o namespace xmlns
            const { method, action } = this.utility.getSoapInfo(this.metodo);

            // Criando envelop SOAP (estrutura para e envio do XML)
            const xmlFormated = this.xmlBuilder.buildSoapEnvelope(xmlConsulta, method);

            // Retorna o Http.Agent contendo os certificados das Autoridades Certificadoras
            const agent = this.environment.getHttpAgent();

            // Retorna a url do webservice NFEStatusServico
            const webServiceUrl = this.utility.getWebServiceUrl(this.metodo, ambienteNacional || this.isAmbienteNacional(this.tpEvento));

            return {
                xmlFormated,
                agent,
                webServiceUrl,
                action
            }

        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    private trataRetorno(responseInJson: GenericObject) {
        const retornoEventos = this.utility.findInObj(responseInJson, 'retEvento')

        if (retornoEventos instanceof Array) {
            for (let i = 0; i < retornoEventos.length; i++) {
                const chNFe = retornoEventos[i].infEvento.chNFe;
                const xMotivo = retornoEventos[i].infEvento.xMotivo;
                const cStat = retornoEventos[i].infEvento.cStat;
                const tipoEvento = this.getTipoEventoName(retornoEventos[i].infEvento.tpEvento);
                this.xMotivoPorEvento.push({
                    chNFe,
                    xMotivo,
                    cStat,
                    tipoEvento
                })
            }
            return this.xMotivoPorEvento;
        }
        const chNFe = retornoEventos.infEvento.chNFe;
        const xMotivo = retornoEventos.infEvento.xMotivo;
        const cStat = retornoEventos.infEvento.cStat;
        const tipoEvento = this.getTipoEventoName(retornoEventos.infEvento.tpEvento);
        this.xMotivoPorEvento.push({
            chNFe,
            xMotivo,
            cStat,
            tipoEvento
        })

        return this.xMotivoPorEvento;
    }

    protected async enviaEvento(evento: TipoEvento[], idLote: number, tipoAmbiente: number) {
        try {
            const ambienteNacional = tipoAmbiente === 0 ? true : false;
            // Gerando XML para consulta de Status do Serviço
            const xmlConsulta = this.gerarXmlRecepcaoEvento(evento, idLote, ambienteNacional);

            const { xmlFormated, agent, webServiceUrl, action } = await this.gerarConsulta(xmlConsulta, ambienteNacional);

            // Salva XML de Consulta
            const fileName = ambienteNacional ? 'RecepcaoEvento[Nacional]-consulta' : 'RecepcaoEvento[Regional]-consulta'
            this.utility.salvaConsulta(xmlConsulta, xmlFormated, this.metodo, fileName);

            // Efetua requisição para o webservice NFEStatusServico
            const xmlRetorno = await this.axios.post(webServiceUrl, xmlFormated, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': action,
                },
                httpsAgent: agent
            });

            return xmlRetorno.data
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    async Exec(data: EventoNFe) {
        try {
            const { evento, idLote } = data;
            const { nacional, regional } = this.separaEventosPorAmbiente(evento);

            // Enviar eventos ambiente nacional e regional separadamente
            let responseNacionalInJson, responseRegionalInJson = null
            let finalResponseInJson = []

            if (nacional.length > 0) {
                const retornoNacional = await this.enviaEvento(nacional, idLote, 0);

                responseNacionalInJson = this.utility.verificaRejeicao(retornoNacional, this.metodo);

                this.utility.salvaRetorno(retornoNacional, responseNacionalInJson, this.metodo, 'RecepcaoEvento[Nacional]-retorno');

                this.trataRetorno(responseNacionalInJson);
                finalResponseInJson.push(responseNacionalInJson)
            }

            if (regional.length > 0) {
                const retornoRegional = await this.enviaEvento(regional, idLote, 1);

                responseRegionalInJson = this.utility.verificaRejeicao(retornoRegional, this.metodo);

                this.utility.salvaRetorno(retornoRegional, responseRegionalInJson, this.metodo, 'RecepcaoEvento[Regional]-retorno');

                this.trataRetorno(responseRegionalInJson);
                finalResponseInJson.push(responseRegionalInJson)
            }

            // if (responseNacionalInJson && responseRegionalInJson) {
            //     // Juntar as duas consultas 
            //     const envEvento = {
            //         $: {
            //             versao: "1.00",
            //             xmlns: 'http://www.portalfiscal.inf.br/nfe'
            //         },
            //         idLote,
            //         _: '[XML]'
            //     }
            //     const xml = this.xmlBuilder.gerarXml(envEvento, 'envEvento')

            //     const eventos = this.xmlEventosNacionais.concat(this.xmlEventosRegionais);

            //     const xmlConsultaFinal = xml.replace('[XML]', eventos.join(''));
            //     // console.log(xmlConsultaFinal);
            // }

            return {
                success: true,
                xMotivos: this.xMotivoPorEvento,
                response: finalResponseInJson,
            };
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

}

export default NFERecepcaoEvento;