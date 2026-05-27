
import { JsonController, Get, Post, Delete, Body, Param, Authorized, Res, CurrentUser } from 'routing-controllers';
import { Response } from 'express';
import { Service } from 'typedi';
import { BaseController } from './BaseController.js';
import { IAddReviewUseCase } from '../../core/usecases/review/AddReviewUseCase.js';
import { IListProductReviewsUseCase } from '../../core/usecases/review/ListProductReviewsUseCase.js';
import { IDeleteReviewUseCase } from '../../core/usecases/review/DeleteReviewUseCase.js';
import { AddReviewDto } from '../dtos/review/AddReviewDto.js';
import Container from '../../config/Containers/AppContainers.js';

@JsonController('/reviews')
@Service()
export class ReviewController extends BaseController {
    private addReviewUseCase: IAddReviewUseCase;
    private listProductReviewsUseCase: IListProductReviewsUseCase;
    private deleteReviewUseCase: IDeleteReviewUseCase;

    constructor() {
        super();
        this.addReviewUseCase = Container.get('IAddReviewUseCase') as IAddReviewUseCase;
        this.listProductReviewsUseCase = Container.get('IListProductReviewsUseCase') as IListProductReviewsUseCase;
        this.deleteReviewUseCase = Container.get('IDeleteReviewUseCase') as IDeleteReviewUseCase;
    }

    @Post('/')
    @Authorized()
    async add(@Body() dto: AddReviewDto, @CurrentUser() user: { id: string }, @Res() res: Response) {
        const result = await this.addReviewUseCase.execute({ ...dto, userId: user.id });
        return this.handleResultAsJson(result, res);
    }

    @Get('/product/:productId')
    async list(@Param('productId') productId: string, @Res() res: Response) {
        const result = await this.listProductReviewsUseCase.execute(productId);
        return this.handleResultAsJson(result, res);
    }

    @Delete('/:id')
    @Authorized()
    async delete(@Param('id') id: string, @CurrentUser() user: { id: string; role?: string }, @Res() res: Response) {
        const isAdmin = user.role === 'admin';
        const result = await this.deleteReviewUseCase.execute(id, user.id, isAdmin);
        return this.handleResultAsJson(result, res);
    }
}